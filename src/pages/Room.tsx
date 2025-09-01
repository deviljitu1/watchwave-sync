import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Video, Users, Copy, LogOut, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  profiles?: {
    display_name?: string;
    username?: string;
  };
}

const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!user || !roomCode) {
      navigate('/auth');
      return;
    }

    fetchRoomData();
    setupRealtimeSubscriptions();
  }, [user, roomCode]);

  const fetchRoomData = async () => {
    if (!roomCode) return;

    try {
      // Fetch room details
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) {
        toast({
          title: "Room not found",
          description: "This room doesn't exist or has been closed.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setRoom(roomData);

      // Fetch participants with profile information
      const { data: participantsData, error: participantsError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomData.id);

      if (participantsError) throw participantsError;

      // Get profile information separately
      if (participantsData && participantsData.length > 0) {
        const userIds = participantsData.map(p => p.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .in('user_id', userIds);

        if (!profilesError && profilesData) {
          // Merge participant and profile data
          const participantsWithProfiles = participantsData.map(participant => ({
            ...participant,
            profiles: profilesData.find(p => p.user_id === participant.user_id) || {}
          }));
          setParticipants(participantsWithProfiles);
        } else {
          setParticipants(participantsData);
        }
      } else {
        setParticipants([]);
      }

      // Check if current user is participant and host
      if (user) {
        const userParticipant = participantsData?.find(p => p.user_id === user.id);
        setIsParticipant(!!userParticipant);
        setIsHost(userParticipant?.is_host || false);
      }
    } catch (error: any) {
      toast({
        title: "Error loading room",
        description: error.message,
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!roomCode) return;

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room_${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `room_code=eq.${roomCode.toUpperCase()}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRoom(payload.new as Room);
          } else if (payload.eventType === 'DELETE') {
            toast({
              title: "Room closed",
              description: "This room has been closed by the host.",
              variant: "destructive"
            });
            navigate('/');
          }
        }
      )
      .subscribe();

    // Subscribe to participant changes
    const participantsChannel = supabase
      .channel(`participants_${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants'
        },
        () => {
          // Refetch participants when changes occur
          fetchRoomData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantsChannel);
    };
  };

  const copyRoomCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.room_code);
      toast({
        title: "Room code copied",
        description: "Share this code with friends to invite them!"
      });
    }
  };

  const leaveRoom = async () => {
    if (!room || !user) return;

    try {
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left room",
        description: "You've successfully left the room."
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error leaving room",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatDisplayName = (participant: RoomParticipant) => {
    const profile = participant.profiles as any;
    if (profile?.display_name) return profile.display_name;
    if (profile?.username) return profile.username;
    return 'Anonymous User';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room || !isParticipant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Room Access Required</CardTitle>
            <CardDescription>
              You need to join this room to access it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Video className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">{room.name}</h1>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {room.room_code}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyRoomCode}
                  className="h-auto p-1"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isHost && (
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={leaveRoom}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Room
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Video Player Area */}
          <div className="lg:col-span-3">
            <Card className="aspect-video bg-muted flex items-center justify-center">
              <div className="text-center">
                <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No video playing</h3>
                <p className="text-muted-foreground">
                  {isHost ? 'Add a video URL to start watching together' : 'Waiting for the host to start a video'}
                </p>
                {isHost && (
                  <Button className="mt-4">
                    Add Video URL
                  </Button>
                )}
              </div>
            </Card>
            
            {room.description && (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">{room.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Participants Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Participants</span>
                  <Badge variant="secondary">{participants.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">
                      {formatDisplayName(participant)}
                    </span>
                    {participant.is_host && (
                      <Badge variant="default" className="text-xs">
                        Host
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Room;