-- Create rooms table for watch parties
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  host_user_id UUID NOT NULL,
  current_video_url TEXT,
  current_video_time DECIMAL DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room_participants table for tracking who's in each room
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_host BOOLEAN DEFAULT false,
  UNIQUE(room_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms
CREATE POLICY "Rooms are viewable by participants and public for joining"
ON public.rooms
FOR SELECT
USING (
  is_active = true AND (
    auth.uid() IN (
      SELECT user_id FROM public.room_participants 
      WHERE room_id = id
    )
    OR true -- Allow viewing for joining purposes
  )
);

CREATE POLICY "Users can create rooms"
ON public.rooms
FOR INSERT
WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update their room"
ON public.rooms
FOR UPDATE
USING (auth.uid() = host_user_id);

CREATE POLICY "Host can delete their room"
ON public.rooms
FOR DELETE
USING (auth.uid() = host_user_id);

-- RLS policies for room_participants
CREATE POLICY "Room participants are viewable by other participants"
ON public.room_participants
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.room_participants 
    WHERE room_id = room_participants.room_id
  )
);

CREATE POLICY "Users can join rooms"
ON public.room_participants
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON public.room_participants
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_rooms_room_code ON public.rooms(room_code);
CREATE INDEX idx_rooms_host_user_id ON public.rooms(host_user_id);
CREATE INDEX idx_room_participants_room_id ON public.room_participants(room_id);
CREATE INDEX idx_room_participants_user_id ON public.room_participants(user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.rooms WHERE room_code = code) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for rooms and participants
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;