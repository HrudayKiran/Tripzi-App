-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create notification trigger for likes
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip_owner_id uuid;
  v_liker_name text;
  v_destination text;
BEGIN
  -- Get trip owner and destination
  SELECT user_id, destination INTO v_trip_owner_id, v_destination
  FROM trips WHERE id = NEW.trip_id;
  
  -- Don't notify if user likes their own trip
  IF v_trip_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker name
  SELECT full_name INTO v_liker_name
  FROM profiles WHERE id = NEW.user_id;
  
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_trip_owner_id,
    'like',
    'New Like',
    COALESCE(v_liker_name, 'Someone') || ' liked your trip to ' || v_destination,
    NEW.trip_id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_like
  AFTER INSERT ON public.trip_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Create notification trigger for comments
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip_owner_id uuid;
  v_commenter_name text;
  v_destination text;
BEGIN
  -- Get trip owner and destination
  SELECT user_id, destination INTO v_trip_owner_id, v_destination
  FROM trips WHERE id = NEW.trip_id;
  
  -- Don't notify if user comments on their own trip
  IF v_trip_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter name
  SELECT full_name INTO v_commenter_name
  FROM profiles WHERE id = NEW.user_id;
  
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_trip_owner_id,
    'comment',
    'New Comment',
    COALESCE(v_commenter_name, 'Someone') || ' commented on your trip to ' || v_destination,
    NEW.trip_id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_comment
  AFTER INSERT ON public.trip_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Create notification trigger for new messages
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name text;
BEGIN
  -- Get sender name
  SELECT full_name INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;
  
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.receiver_id,
    'message',
    'New Message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    NEW.sender_id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();