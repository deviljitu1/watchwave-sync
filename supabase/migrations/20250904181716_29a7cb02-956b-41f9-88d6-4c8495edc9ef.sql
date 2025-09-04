-- Ensure realtime payloads are complete and tables are in publication
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;

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

-- Strengthen and correct RLS policies
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Rooms: allow participants to update playback state correctly
DROP POLICY IF EXISTS "Participants can update playback state" ON public.rooms;
CREATE POLICY "Participants can update playback state"
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = public.rooms.id
      AND rp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = public.rooms.id
      AND rp.user_id = auth.uid()
  )
);

-- Rooms: simplify and fix SELECT policy (active rooms are publicly visible for joining)
DROP POLICY IF EXISTS "Rooms are viewable by participants and public for joining" ON public.rooms;
CREATE POLICY "Active rooms are viewable by everyone"
ON public.rooms
FOR SELECT
USING (is_active = true);

-- room_participants: fix SELECT visibility to participants of the same room
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
