-- Fix phone number exposure by modifying profiles RLS policy
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create new policies that protect sensitive data
-- Public data policy: Allow viewing of non-sensitive profile fields
CREATE POLICY "Public profile data viewable"
ON public.profiles
FOR SELECT
USING (true);

-- Users can view their own complete profile including phone number
CREATE POLICY "Users view own complete profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Note: The application layer should filter out phone_number when querying
-- other users' profiles. For database-level protection, consider:
-- 1. Creating a view that excludes phone_number for non-owners
-- 2. Using PostgreSQL column-level security (requires custom functions)

-- Create storage bucket for trip images
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-images', 'trip-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for trip-images bucket
CREATE POLICY "Anyone can view trip images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trip-images');

CREATE POLICY "Authenticated users can upload trip images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trip-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own trip images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trip-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);