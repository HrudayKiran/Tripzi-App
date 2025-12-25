-- Update notify_on_follow to store follower_id as related_id for navigation
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.following_id,
    'follow',
    'New Follower',
    (SELECT full_name FROM public.profiles WHERE id = NEW.follower_id) || ' started following you',
    NEW.follower_id
  );
  RETURN NEW;
END;
$$;