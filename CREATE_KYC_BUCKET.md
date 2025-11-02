# Fix KYC Upload - Create Storage Bucket

## Problem
You're getting "upload failed bucket not found" because the `kyc-documents` storage bucket doesn't exist.

## Solution: Create the Bucket

### Method 1: Via Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New Bucket"** or **"Create Bucket"**
4. Enter these settings:
   - **Name**: `kyc-documents`
   - **Public**: **No** (unchecked - keep it private)
   - **File size limit**: `5 MB` (optional)
   - **Allowed MIME types**: `image/jpeg, image/png, image/jpg, application/pdf` (optional)
5. Click **"Create Bucket"**

### Method 2: Via SQL Editor

Run this SQL in your Supabase SQL Editor:

```sql
-- Create kyc-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,  -- Private bucket
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies (these should already be in your migration, but run them again)
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

-- Policy: Admins can upload documents
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
```

## Verification

After creating the bucket:

1. Go back to Storage in Supabase Dashboard
2. You should see `kyc-documents` in your bucket list
3. Try submitting a KYC request again in the app
4. The upload should now work!

## Troubleshooting

If you still get errors:

1. **Check bucket exists**: Go to Storage → check if `kyc-documents` appears
2. **Check RLS policies**: Go to Storage → `kyc-documents` → Policies tab
3. **Check file size**: Make sure your document is under 5MB
4. **Check file type**: Only JPG, PNG, and PDF files are allowed

