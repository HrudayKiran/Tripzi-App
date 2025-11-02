-- Role Assignment System Documentation and Helper Functions
-- This migration provides documentation and helper utilities for role management

-- ============================================================================
-- ROLE ASSIGNMENT WORKFLOW
-- ============================================================================
-- 
-- 1. USER REGISTRATION:
--    - All new users automatically get role = 'user' via handle_new_user() trigger
--    - This happens automatically on signup - no manual intervention needed
--
-- 2. ADMIN ROLE ASSIGNMENT:
--    - Only app owner/developer can assign admin role via direct SQL
--    - Method 1: Via Supabase SQL Editor or psql:
--      UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
--      UPDATE profiles SET role = 'admin' WHERE email = 'admin@email.com';
--    
--    - Method 2: Via Supabase Dashboard:
--      1. Go to Table Editor > profiles table
--      2. Find the user
--      3. Edit the 'role' field and change from 'user' to 'admin'
--      4. Save changes
--
-- 3. VERIFICATION:
--    - Check current user role: SELECT id, full_name, role FROM profiles WHERE id = 'user-uuid';
--    - List all admins: SELECT id, full_name, email FROM profiles WHERE role = 'admin';
--
-- 4. SECURITY:
--    - RLS policies prevent users from changing their own role
--    - Only database admins/owners can modify role field directly
--    - Frontend code checks role on login and restricts admin routes
--
-- ============================================================================

-- Helper function: Get user role (for admin use)
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_role, 'user');
END;
$$;

-- Helper function: Check if user is admin (for use in RLS policies and functions)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = p_user_id 
    AND role = 'admin'
  );
END;
$$;

-- View: All admins (for admin dashboard/management)
CREATE OR REPLACE VIEW public.admins_view AS
SELECT 
  p.id,
  p.full_name,
  u.email,
  p.role,
  p.created_at,
  p.updated_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';

-- Grant access to view (read-only for authenticated users, but RLS will filter)
GRANT SELECT ON public.admins_view TO authenticated;

-- ============================================================================
-- ROLE ASSIGNMENT EXAMPLES (Run these in Supabase SQL Editor)
-- ============================================================================
-- 
-- Example 1: Make a specific user an admin by email
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
--
-- Example 2: Make a specific user an admin by user ID
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE id = 'user-uuid-here';
--
-- Example 3: List all current admins
-- SELECT id, full_name, email, role, created_at 
-- FROM profiles p
-- JOIN auth.users u ON p.id = u.id
-- WHERE role = 'admin';
--
-- Example 4: Remove admin role (downgrade to user)
-- UPDATE profiles 
-- SET role = 'user' 
-- WHERE id = 'user-uuid-here';
--
-- Example 5: Check a specific user's role
-- SELECT role FROM profiles WHERE id = 'user-uuid-here';
--
-- ============================================================================
-- AUDIT TRACKING (Optional - for future expansion)
-- ============================================================================
-- 
-- To track role changes, you could create an audit table:
-- 
-- CREATE TABLE IF NOT EXISTS public.role_changes (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   old_role TEXT,
--   new_role TEXT NOT NULL,
--   changed_by UUID REFERENCES auth.users(id),
--   changed_at TIMESTAMPTZ DEFAULT NOW(),
--   reason TEXT
-- );
--
-- Then create a trigger to log role changes:
-- 
-- CREATE OR REPLACE FUNCTION public.log_role_change()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF OLD.role IS DISTINCT FROM NEW.role THEN
--     INSERT INTO public.role_changes (user_id, old_role, new_role, changed_at)
--     VALUES (NEW.id, OLD.role, NEW.role, NOW());
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER on_role_change
--   AFTER UPDATE OF role ON public.profiles
--   FOR EACH ROW
--   WHEN (OLD.role IS DISTINCT FROM NEW.role)
--   EXECUTE FUNCTION public.log_role_change();
--
-- ============================================================================

