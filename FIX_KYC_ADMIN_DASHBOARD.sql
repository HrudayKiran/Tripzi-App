-- Fix Admin Dashboard KYC Requests Access
-- Run this SQL in Supabase SQL Editor

-- Step 1: Verify your admin role
SELECT id, full_name, role 
FROM public.profiles 
WHERE role = 'admin';

-- Step 2: Check if kyc_requests table exists and has data
SELECT COUNT(*) as total_requests FROM public.kyc_requests;

-- Step 3: Drop and recreate RLS policies to ensure they work correctly
DROP POLICY IF EXISTS "Users view own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Users create own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins view all kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins update kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins can update kyc requests" ON public.kyc_requests;

-- Recreate policies

-- Policy 1: Users can view their own KYC requests
CREATE POLICY "Users view own kyc requests" 
ON public.kyc_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can create KYC requests
CREATE POLICY "Users create own kyc requests" 
ON public.kyc_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Admins can view ALL KYC requests (MUST WORK for admin dashboard)
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Step 4: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'kyc_requests';

-- Step 5: Test admin query (if you know your user ID)
-- Replace 'YOUR-USER-ID' with your actual UUID from step 1
-- This should return all KYC requests if you're admin
-- SELECT * FROM public.kyc_requests LIMIT 10;

