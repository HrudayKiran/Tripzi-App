-- Fix security warnings by setting search_path on functions

-- Update notify_followers_on_trip_post function
CREATE OR REPLACE FUNCTION public.notify_followers_on_trip_post()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  SELECT 
    follower_id,
    'trip_post',
    'New Trip Posted',
    (SELECT full_name FROM public.profiles WHERE id = NEW.user_id) || ' posted a new trip to ' || NEW.destination,
    NEW.id
  FROM public.follows
  WHERE following_id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Update notify_trip_owner_on_booking function
CREATE OR REPLACE FUNCTION public.notify_trip_owner_on_booking()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  SELECT 
    trips.user_id,
    'booking',
    'New Booking',
    (SELECT full_name FROM public.profiles WHERE id = NEW.user_id) || ' booked your trip to ' || trips.destination,
    NEW.id
  FROM public.trips
  WHERE id = NEW.trip_id;
  RETURN NEW;
END;
$$;

-- Update notify_on_follow function
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.following_id,
    'follow',
    'New Follower',
    (SELECT full_name FROM public.profiles WHERE id = NEW.follower_id) || ' started following you',
    NEW.id
  );
  RETURN NEW;
END;
$$;