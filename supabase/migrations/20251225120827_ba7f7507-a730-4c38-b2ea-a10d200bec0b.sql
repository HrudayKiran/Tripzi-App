-- Add message_status column to messages table for delivery status tracking
-- 'sent' = sent to server, 'delivered' = delivered to recipient's device, 'read' = read by recipient
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent';

-- Create a table for WebRTC signaling
CREATE TABLE IF NOT EXISTS public.call_signaling (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'declined', 'ended', 'missed')),
  signal_data jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for call_signaling
ALTER TABLE public.call_signaling ENABLE ROW LEVEL SECURITY;

-- Policies for call_signaling
CREATE POLICY "Users can see their own calls" 
ON public.call_signaling 
FOR SELECT 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls" 
ON public.call_signaling 
FOR INSERT 
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their calls" 
ON public.call_signaling 
FOR UPDATE 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Enable realtime for call_signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signaling;

-- Create typing_indicators table for real-time typing status
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_with)
);

-- Enable RLS for typing_indicators
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Policies for typing_indicators
CREATE POLICY "Users can see typing status for their chats" 
ON public.typing_indicators 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = chat_with);

CREATE POLICY "Users can manage their typing status" 
ON public.typing_indicators 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for typing_indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;