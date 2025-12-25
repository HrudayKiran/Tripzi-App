-- Insert admin role for user kiran (webbusinesswithkiran@gmail.com)
INSERT INTO public.user_roles (user_id, role)
VALUES ('b7e2fa91-33a9-4f73-9db9-3e93dae0a7fa', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;