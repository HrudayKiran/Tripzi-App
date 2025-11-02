-- Create KYC Documents Storage Bucket
-- This migration creates the storage bucket needed for KYC document uploads

-- Create kyc-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,  -- Private bucket (users can only access their own documents)
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
-- Files must be in a folder named with their user ID
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

