import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface Room {
  id: string;
  room_code: string;
  name: string;
  description?: string;
  host_user_id: string;
  current_video_url?: string;
  current_video_time: number;
  is_playing: boolean;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  updated_at: string;
}

interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  is_host: boolean;
}

export function useRooms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyRooms();
    }
  }, [user]);

  const fetchMyRooms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('host_user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRooms(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching rooms",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (name: string, description?: string, maxParticipants?: number) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      // Generate room code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_room_code');

      if (codeError) throw codeError;

      // Create room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: codeData,
          name,
          description,
          host_user_id: user.id,
          max_participants: maxParticipants || 50
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add host as participant
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          is_host: true
        });

      if (participantError) throw participantError;

      toast({
        title: "Room created successfully",
        description: `Room code: ${room.room_code}`
      });

      await fetchMyRooms();
      return { data: room, error: null };
    } catch (error: any) {
      toast({
        title: "Error creating room",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const joinRoom = async (roomCode: string) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      // Find room by code
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!room) {
        throw new Error('Room not found');
      }

      // Check if already a participant
      const { data: existingParticipant } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingParticipant) {
        toast({
          title: "Already in room",
          description: "You're already a participant in this room"
        });
        return { data: room, error: null };
      }

      // Check participant count
      const { count, error: countError } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if (countError) throw countError;
      if (count && count >= room.max_participants) {
        throw new Error('Room is full');
      }

      // Add as participant
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          is_host: false
        });

      if (participantError) throw participantError;

      toast({
        title: "Joined room successfully",
        description: `Welcome to ${room.name}`
      });

      return { data: room, error: null };
    } catch (error: any) {
      toast({
        title: "Error joining room",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const leaveRoom = async (roomId: string) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left room successfully"
      });

      await fetchMyRooms();
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error leaving room",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', roomId)
        .eq('host_user_id', user.id);

      if (error) throw error;

      toast({
        title: "Room deleted successfully"
      });

      await fetchMyRooms();
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error deleting room",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  return {
    rooms,
    myRooms,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    fetchMyRooms
  };
}