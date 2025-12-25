-- Create stories table for Instagram/WhatsApp-like stories
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- RLS policies for stories
CREATE POLICY "Anyone can view non-expired stories"
ON public.stories FOR SELECT
USING (expires_at > now());

CREATE POLICY "Users can create their own stories"
ON public.stories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
ON public.stories FOR DELETE
USING (auth.uid() = user_id);

-- Create trip_likes table for like functionality
CREATE TABLE public.trip_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trip_id)
);

-- Enable RLS on trip_likes
ALTER TABLE public.trip_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_likes
CREATE POLICY "Anyone can view likes"
ON public.trip_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like trips"
ON public.trip_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike trips"
ON public.trip_likes FOR DELETE
USING (auth.uid() = user_id);

-- Create trip_comments table
CREATE TABLE public.trip_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on trip_comments
ALTER TABLE public.trip_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_comments
CREATE POLICY "Anyone can view comments"
ON public.trip_comments FOR SELECT
USING (true);

CREATE POLICY "Users can create comments"
ON public.trip_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.trip_comments FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for stories
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for stories bucket
CREATE POLICY "Anyone can view stories images"
ON storage.objects FOR SELECT
USING (bucket_id = 'stories');

CREATE POLICY "Users can upload story images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their story images"
ON storage.objects FOR DELETE
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);