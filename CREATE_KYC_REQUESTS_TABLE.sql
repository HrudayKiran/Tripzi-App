-- URGENT: Create kyc_requests table and all related tables
-- Copy and paste this entire SQL into Supabase SQL Editor and run it

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

-- Enable RLS on kyc_requests
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kyc_requests
DROP POLICY IF EXISTS "Users view own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Users create own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins view all kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins update kyc requests" ON public.kyc_requests;

-- Users can view their own KYC requests
CREATE POLICY "Users view own kyc requests" 
ON public.kyc_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own KYC requests
CREATE POLICY "Users create own kyc requests" 
ON public.kyc_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Only admins can view all KYC requests
CREATE POLICY "Admins view all kyc requests" 
ON public.kyc_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Only admins can update KYC requests
CREATE POLICY "Admins update kyc requests" 
ON public.kyc_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for updated_at on kyc_requests
DROP TRIGGER IF EXISTS update_kyc_requests_updated_at ON public.kyc_requests;
CREATE TRIGGER update_kyc_requests_updated_at 
  BEFORE UPDATE ON public.kyc_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update profile kyc_status when KYC request is approved/rejected
CREATE OR REPLACE FUNCTION public.update_profile_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
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

-- Create trigger for updating profile kyc_status
DROP TRIGGER IF EXISTS on_kyc_status_change ON public.kyc_requests;
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

-- Create trigger for notifications
DROP TRIGGER IF EXISTS on_kyc_notification ON public.kyc_requests;
CREATE TRIGGER on_kyc_notification
  AFTER UPDATE ON public.kyc_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_kyc_status_change();

-- Update notifications table to support kyc_status type if constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications 
    DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('trip_post', 'booking', 'follow', 'message', 'kyc_status'));

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'kyc_requests'
ORDER BY ordinal_position;

