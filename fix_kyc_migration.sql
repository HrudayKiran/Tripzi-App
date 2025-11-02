-- Fix KYC migration issues
-- This script should be run in Supabase SQL Editor

-- 1. Add kyc_status column to profiles table if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'not_submitted'
CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected'));

-- 2. Update existing profiles to have default kyc_status if NULL
UPDATE public.profiles SET kyc_status = 'not_submitted' WHERE kyc_status IS NULL;

-- 3. Create kyc_requests table if it doesn't exist
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

-- 4. Enable RLS on kyc_requests
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for kyc_requests
DROP POLICY IF EXISTS "Users view own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Users create own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins view all kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins update kyc requests" ON public.kyc_requests;

CREATE POLICY "Users view own kyc requests" ON public.kyc_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own kyc requests" ON public.kyc_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all kyc requests" ON public.kyc_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins update kyc requests" ON public.kyc_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Create storage policies for kyc-documents bucket
DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users view own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload kyc documents" ON storage.objects;

CREATE POLICY "Users upload own kyc documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users view own kyc documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

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

-- 8. Create trigger function to update profile kyc_status
CREATE OR REPLACE FUNCTION public.update_profile_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    UPDATE public.profiles
    SET kyc_status = NEW.status
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger for kyc status updates
DROP TRIGGER IF EXISTS on_kyc_status_change ON public.kyc_requests;
CREATE TRIGGER on_kyc_status_change
  AFTER UPDATE ON public.kyc_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_profile_kyc_status();

-- 10. Create trigger for updated_at on kyc_requests
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_kyc_requests_updated_at ON public.kyc_requests;
CREATE TRIGGER update_kyc_requests_updated_at
  BEFORE UPDATE ON public.kyc_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
