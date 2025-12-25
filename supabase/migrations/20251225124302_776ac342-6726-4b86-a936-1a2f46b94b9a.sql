-- Create user roles table for admin functionality
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trip reviews table
CREATE TABLE public.trip_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON public.trip_reviews FOR SELECT USING (true);

CREATE POLICY "Users can create reviews"
  ON public.trip_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.trip_reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.trip_reviews FOR DELETE USING (auth.uid() = user_id);

-- Create group chats table
CREATE TABLE public.group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

-- Group chat members table
CREATE TABLE public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

-- Group messages table
CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS for group chats
CREATE POLICY "Trip members can view group chats"
  ON public.group_chats FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = id AND user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Trip owners can create group chats"
  ON public.group_chats FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- RLS for group chat members
CREATE POLICY "Members can view group members"
  ON public.group_chat_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.group_chat_members gcm WHERE gcm.group_id = group_id AND gcm.user_id = auth.uid())
  );

CREATE POLICY "Group owners can add members"
  ON public.group_chat_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND created_by = auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Users can leave groups"
  ON public.group_chat_members FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for group messages
CREATE POLICY "Members can view group messages"
  ON public.group_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Members can send messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own messages"
  ON public.group_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Create suggestions/feedback table with bug reporting
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'feature', -- 'feature', 'bug', 'improvement'
  category TEXT NOT NULL,
  severity TEXT, -- 'low', 'medium', 'high', 'critical' (for bugs)
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'in_progress', 'resolved', 'rejected'
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Feedback images table
CREATE TABLE public.feedback_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES public.feedback(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_images ENABLE ROW LEVEL SECURITY;

-- RLS for feedback
CREATE POLICY "Users can view their own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON public.feedback FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update feedback"
  ON public.feedback FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for feedback images
CREATE POLICY "Users can view their feedback images"
  ON public.feedback_images FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.feedback WHERE id = feedback_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all feedback images"
  ON public.feedback_images FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can add images to their feedback"
  ON public.feedback_images FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.feedback WHERE id = feedback_id AND user_id = auth.uid())
  );

-- Add enable_group_chat column to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS enable_group_chat BOOLEAN DEFAULT false;

-- Create storage bucket for feedback images
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback images
CREATE POLICY "Users can upload feedback images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their feedback images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all feedback images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-images' AND public.has_role(auth.uid(), 'admin'));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_reviews;

-- Function to auto-create group chat when booking is confirmed (if enabled)
CREATE OR REPLACE FUNCTION public.auto_create_group_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip RECORD;
  v_group_id UUID;
BEGIN
  -- Get trip details
  SELECT * INTO v_trip FROM trips WHERE id = NEW.trip_id;
  
  -- Check if group chat is enabled for this trip
  IF v_trip.enable_group_chat = true THEN
    -- Check if group chat already exists
    SELECT id INTO v_group_id FROM group_chats WHERE trip_id = NEW.trip_id;
    
    IF v_group_id IS NULL THEN
      -- Create group chat
      INSERT INTO group_chats (trip_id, name, created_by)
      VALUES (NEW.trip_id, v_trip.title || ' Group', v_trip.user_id)
      RETURNING id INTO v_group_id;
      
      -- Add trip owner to the group
      INSERT INTO group_chat_members (group_id, user_id)
      VALUES (v_group_id, v_trip.user_id);
    END IF;
    
    -- Add new member to the group (if not already added)
    INSERT INTO group_chat_members (group_id, user_id)
    VALUES (v_group_id, NEW.user_id)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_create_group_chat
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_group_chat();

-- Trigger to update updated_at for feedback
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at for trip_reviews
CREATE TRIGGER update_trip_reviews_updated_at
  BEFORE UPDATE ON public.trip_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();