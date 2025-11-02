-- Add role and kyc_status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'not_submitted' CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected'));

-- Update existing profiles to have default 'user' role if NULL
UPDATE public.profiles SET role = 'user' WHERE role IS NULL;

-- Update handle_new_user function to explicitly set role = 'user' on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone_number',
    'user'  -- Explicitly set role to 'user' for all new registrations
  );
  RETURN NEW;
END;
$$;

-- Create likes table for post engagement
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

-- Create comments table for post engagement
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shares table for post engagement
CREATE TABLE IF NOT EXISTS public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

-- Create kyc_requests table
CREATE TABLE IF NOT EXISTS public.kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kyc_type text NOT NULL CHECK (kyc_type IN ('aadhaar', 'pan')),
  document_number text NOT NULL,
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for likes
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like trips" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike trips" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comments
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for shares
CREATE POLICY "Anyone can view shares" ON public.shares FOR SELECT USING (true);
CREATE POLICY "Users can share trips" ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unshare trips" ON public.shares FOR DELETE USING (auth.uid() = user_id);

-- RLS Policy: Prevent users from changing their own role
-- Drop the old update policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new update policy that prevents role changes
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (
    -- Allow updates if role is not being changed
    OLD.role = NEW.role OR
    -- Or if role is NULL (initial migration case)
    (OLD.role IS NULL AND NEW.role = 'user')
  )
);

-- RLS Policies for kyc_requests
-- Users can view their own KYC requests
CREATE POLICY "Users view own kyc requests" ON public.kyc_requests FOR SELECT USING (auth.uid() = user_id);
-- Users can create their own KYC requests
CREATE POLICY "Users create own kyc requests" ON public.kyc_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Only admins can view all KYC requests
CREATE POLICY "Admins view all kyc requests" ON public.kyc_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Only admins can update KYC requests
CREATE POLICY "Admins update kyc requests" ON public.kyc_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Triggers for updated_at
CREATE TRIGGER update_comments_updated_at 
  BEFORE UPDATE ON public.comments 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kyc_requests_updated_at 
  BEFORE UPDATE ON public.kyc_requests 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update profile kyc_status when KYC request is approved/rejected
CREATE OR REPLACE FUNCTION public.update_profile_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    UPDATE public.profiles
    SET kyc_status = NEW.status
    WHERE id = NEW.user_id;
    
    IF NEW.status = 'verified' THEN
      UPDATE public.profiles
      SET kyc_status = 'verified'
      WHERE id = NEW.user_id;
    ELSIF NEW.status = 'rejected' THEN
      UPDATE public.profiles
      SET kyc_status = 'rejected'
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_kyc_status_change
  AFTER UPDATE ON public.kyc_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_profile_kyc_status();

-- Function to create notification when KYC is approved/rejected
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('verified', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.user_id,
      'kyc_status',
      CASE 
        WHEN NEW.status = 'verified' THEN 'KYC Verified'
        WHEN NEW.status = 'rejected' THEN 'KYC Rejected'
      END,
      CASE 
        WHEN NEW.status = 'verified' THEN 'Your KYC verification has been approved.'
        WHEN NEW.status = 'rejected' THEN 'Your KYC verification was rejected. ' || COALESCE(NEW.admin_notes, 'Please check your documents and try again.')
      END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_kyc_notification
  AFTER UPDATE ON public.kyc_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_kyc_status_change();

-- Update notifications table to support kyc_status type
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('trip_post', 'booking', 'follow', 'message', 'kyc_status'));

-- Create storage bucket for KYC documents
-- Note: This requires Supabase dashboard access to storage
-- If bucket doesn't exist, create it via:
-- Supabase Dashboard > Storage > Create Bucket > Name: kyc-documents, Public: No
-- OR run the SQL below in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,  -- Private bucket
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for kyc-documents bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users view own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload kyc documents" ON storage.objects;

-- Policy: Users can upload their own KYC documents
CREATE POLICY "Users upload own kyc documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own KYC documents
CREATE POLICY "Users view own kyc documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Admins can view all KYC documents
CREATE POLICY "Admins view all kyc documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kyc-documents' 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Policy: Admins can upload documents (for any user if needed)
CREATE POLICY "Admins can upload kyc documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

