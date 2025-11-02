-- Fix Admin Access to KYC Requests
-- Run this SQL in Supabase SQL Editor to ensure admins can view all KYC requests

-- First, verify your profile has admin role
SELECT id, full_name, role FROM public.profiles WHERE role = 'admin';

-- Drop existing policies
DROP POLICY IF EXISTS "Users view own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Users create own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins view all kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins update kyc requests" ON public.kyc_requests;

-- Recreate policies with proper structure

-- Policy 1: Users can view their own KYC requests
CREATE POLICY "Users view own kyc requests" 
ON public.kyc_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can create their own KYC requests
CREATE POLICY "Users create own kyc requests" 
ON public.kyc_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Admins can view ALL KYC requests (this must work for admin dashboard)
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

-- Policy 4: Admins can update KYC requests
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

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'kyc_requests'
ORDER BY policyname;

-- Test query to see if admin can see KYC requests
-- Replace 'YOUR-USER-ID' with your actual user ID
-- SELECT * FROM public.kyc_requests;

