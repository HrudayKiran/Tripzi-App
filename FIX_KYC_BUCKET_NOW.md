# URGENT: Create KYC Storage Bucket

## The Problem
The `kyc-documents` storage bucket doesn't exist in your Supabase project, causing uploads to fail.

## Solution - Choose ONE Method:

### ⚡ Method 1: Supabase Dashboard (FASTEST - 30 seconds)

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (the one with ID: `uvyhruuyaoarxyxzmixb`)
3. **Click "Storage"** in the left sidebar
4. **Click "New Bucket"** button (top right)
5. **Enter these settings**:
   - **Bucket name**: `kyc-documents`
   - **Public bucket**: ❌ **UNCHECKED** (must be private)
   - **File size limit**: `5242880` bytes (5MB) - optional
   - **Allowed MIME types**: Leave blank or add: `image/jpeg, image/png, image/jpg, application/pdf` - optional
6. **Click "Create bucket"**
7. **Done!** ✅

### 📝 Method 2: SQL Editor (Alternative)

1. **Open Supabase Dashboard** → **SQL Editor**
2. **Copy and paste this entire SQL**:

```sql
-- Create kyc-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Create RLS policies for the bucket
DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users view own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload kyc documents" ON storage.objects;

CREATE POLICY "Users upload own kyc documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users view own kyc documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins view all kyc documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can upload kyc documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

3. **Click "Run"** button
4. **Done!** ✅

## ✅ Verify It Worked

1. Go to **Storage** in Supabase Dashboard
2. You should see **`kyc-documents`** in the list of buckets
3. Go back to your app and try uploading a KYC document again

## 🎯 Next Steps After Creating Bucket

1. **Refresh your app** (or just try uploading again)
2. **Submit KYC request** - it should work now!
3. The document will be stored in: `kyc-documents/[user-id]/[document-type]-[timestamp].[ext]`

## ❓ Still Not Working?

If you still get errors after creating the bucket:

1. **Check bucket exists**: Storage → Look for `kyc-documents`
2. **Check bucket is private**: Should be unchecked (not public)
3. **Check RLS policies**: Storage → `kyc-documents` → Policies tab
4. **Refresh browser**: Clear cache and try again

---

**Quick Link**: https://supabase.com/dashboard/project/uvyhruuyaoarxyxzmixb/storage/buckets

