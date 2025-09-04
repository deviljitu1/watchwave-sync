-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Active rooms are viewable by everyone" ON public.rooms;

-- Ensure realtime payloads are complete and tables are in publication
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  END IF;
END $$;

-- Recreate RLS policies with correct logic
CREATE POLICY "Active rooms are viewable by everyone"
ON public.rooms
FOR SELECT
USING (is_active = true);

-- Update the participants policy to fix visibility
DROP POLICY IF EXISTS "Room participants are viewable by other participants" ON public.room_participants;
CREATE POLICY "Room participants are viewable by other participants"
ON public.room_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = public.room_participants.room_id
      AND rp.user_id = auth.uid()
  )
);