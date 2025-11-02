# Role Assignment System Guide

This guide explains how the role assignment system works in Tripzi.

## Overview

Tripzi uses a role-based access control (RBAC) system where users have a `role` field in their `profiles` table. The system supports two roles:
- **user** (default) - Standard platform user
- **admin** - Administrator with access to admin dashboard and KYC management

## User Registration

When a new user registers:

1. **Automatic Role Assignment**: All new accounts are automatically assigned `role = 'user'` by default
2. **Trigger**: The `handle_new_user()` database trigger automatically sets this on profile creation
3. **No Manual Intervention**: This happens automatically - no action required

## Admin Role Assignment

Only app owners/developers can assign admin roles. Regular users **cannot** self-promote.

### Method 1: Via Supabase SQL Editor

```sql
-- Assign admin role to a user by email
UPDATE profiles 
SET role = 'admin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');

-- Or assign by user ID directly
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'user-uuid-here';
```

### Method 2: Via Supabase Dashboard

1. Go to **Table Editor** → `profiles` table
2. Find the user you want to make admin
3. Click on the `role` field
4. Change from `user` to `admin`
5. Save changes

## Security Features

### Frontend Protection

- **Protected Routes**: Admin routes (`/admin/dashboard`) are protected by `ProtectedAdminRoute` component
- **UI Elements**: Admin dashboard link only appears for users with `role = 'admin'`
- **Profile Updates**: Frontend code prevents users from changing their own role

### Backend Protection (RLS Policies)

- **Row Level Security**: Database policies prevent users from modifying their own `role` field
- **Admin Actions**: Only admins can approve/reject KYC requests (enforced via RLS)
- **Direct Access**: Role can only be changed via direct database access (SQL/Dashboard)

## Verification

### Check a User's Role

```sql
-- Get specific user's role
SELECT id, full_name, role 
FROM profiles 
WHERE id = 'user-uuid-here';

-- Or by email
SELECT p.id, p.full_name, p.role, u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'user@example.com';
```

### List All Admins

```sql
SELECT p.id, p.full_name, u.email, p.role, p.created_at 
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';
```

## Application Logic

### On Login

When a user logs in:

1. App fetches user profile including `role` field
2. `AuthContext` stores the role in the profile object
3. UI elements check `profile?.role === 'admin'` to show/hide admin features

### Access Control

- **Standard Users**: Can access all regular features (feed, trips, profile, etc.)
- **Admins**: Have access to everything + admin dashboard (`/admin/dashboard`)

### Admin Dashboard Features

- View all KYC requests (pending, verified, rejected)
- Approve or reject KYC requests
- Add admin notes when rejecting
- View submitted KYC documents

## Removing Admin Role

To downgrade an admin back to regular user:

```sql
UPDATE profiles 
SET role = 'user' 
WHERE id = 'user-uuid-here';
```

## Future Extensions

The system is designed to be extensible:

1. **Additional Roles**: Can add roles like `moderator`, `super-admin`, etc. by:
   - Updating the CHECK constraint in the database
   - Adding role checks in frontend code
   - Creating new RLS policies if needed

2. **Audit Logging**: Can add an audit table to track role changes:
   - Who changed the role
   - When it was changed
   - Reason for change

3. **Role-Based Permissions**: Can create a permissions system that maps roles to specific capabilities

## Troubleshooting

### User Cannot Access Admin Dashboard

1. Check if user's role is actually `admin`:
   ```sql
   SELECT role FROM profiles WHERE id = 'user-uuid';
   ```

2. Verify user is logged in and profile is loaded

3. Check browser console for any errors

### Role Not Updating

- Ensure you have database admin privileges
- Check that RLS policies aren't blocking the update
- Verify the user ID is correct

## Migration Files

The role system is implemented via these migrations:

1. `20251201000000_add_engagement_kyc_admin.sql` - Adds role field and default assignment
2. `20251201000001_role_assignment_guide.sql` - Helper functions and documentation

## Support

For issues with role assignment, contact the app owner/developer with database access.

