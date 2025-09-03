-- Fix: add participant update policy (no IF NOT EXISTS)
DROP POLICY IF EXISTS "Participants can update playback state" ON public.rooms;
CREATE POLICY "Participants can update playback state"
ON public.rooms
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT rp.user_id FROM public.room_participants rp WHERE rp.room_id = id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT rp.user_id FROM public.room_participants rp WHERE rp.room_id = id
  )
);

-- Create/replace trigger function to restrict non-host updates to playback fields only
CREATE OR REPLACE FUNCTION public.enforce_rooms_update_permissions()
RETURNS trigger AS $$
DECLARE
  acting_user uuid := auth.uid();
  is_participant boolean;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Host can update anything
  IF acting_user = OLD.host_user_id THEN
    RETURN NEW;
  END IF;

  -- Must be a participant
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants rp WHERE rp.room_id = OLD.id AND rp.user_id = acting_user
  ) INTO is_participant;

  IF NOT is_participant THEN
    RAISE EXCEPTION 'Only room participants can update this room';
  END IF;

  -- Participants can only change playback-related fields
  IF NEW.is_playing IS DISTINCT FROM OLD.is_playing
     OR NEW.current_video_time IS DISTINCT FROM OLD.current_video_time
     OR NEW.current_video_url IS DISTINCT FROM OLD.current_video_url
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    -- Ensure other columns remain unchanged
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.room_code IS DISTINCT FROM OLD.room_code
       OR NEW.host_user_id IS DISTINCT FROM OLD.host_user_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.max_participants IS DISTINCT FROM OLD.max_participants
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.description IS DISTINCT FROM OLD.description THEN
      RAISE EXCEPTION 'Participants can only update playback state';
    END IF;
    RETURN NEW;
  ELSE
    -- No permitted changes
    RAISE EXCEPTION 'No permitted changes in update';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_enforce_rooms_update_permissions ON public.rooms;
CREATE TRIGGER trg_enforce_rooms_update_permissions
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rooms_update_permissions();
