-- URGENT: Fix Admin Access to KYC Requests
-- Run this in Supabase SQL Editor

-- Step 1: Check your admin role first
SELECT id, full_name, role, email 
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';

-- Step 2: Drop all existing policies on kyc_requests
DROP POLICY IF EXISTS "Users view own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Users create own kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins view all kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins update kyc requests" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admins can update kyc requests" ON public.kyc_requests;

-- Step 3: Recreate policies with correct logic

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

-- Policy 3: Admins can view ALL KYC requests (CRITICAL for admin dashboard)
-- This policy must work correctly for admin dashboard
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

-- Step 4: Verify policies are correct
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'kyc_requests'
ORDER BY policyname;

-- Step 5: Test if admin can see requests (replace YOUR_USER_ID with actual UUID)
-- SELECT COUNT(*) FROM public.kyc_requests;

-- Step 6: Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'kyc_requests';

