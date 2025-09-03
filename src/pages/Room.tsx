import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Video, Users, Copy, LogOut, Settings, Loader2, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, RotateCcw, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// YouTube API type declarations
declare global {
  interface Window {
    YT: {
      Player: any;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

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

  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [player, setPlayer] = useState<any>(null);
  const [isYouTubeReady, setIsYouTubeReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const playerRef = useRef<any>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const extractYouTubeVideoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      // youtu.be/<id>
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '');
      }
      // youtube.com/watch?v=<id>
      if (u.hostname.includes('youtube.com')) {
        return u.searchParams.get('v');
      }
      // youtube.com/embed/<id>
      if (u.pathname.includes('/embed/')) {
        return u.pathname.split('/embed/')[1];
      }
    } catch {
      return null;
    }
    return null;
  };

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        setIsYouTubeReady(true);
      };
    } else {
      setIsYouTubeReady(true);
    }
  }, []);

  // Initialize YouTube player when video URL changes
  useEffect(() => {
    if (!isYouTubeReady || !room?.current_video_url) return;
    
    const videoId = extractYouTubeVideoId(room.current_video_url);
    if (!videoId) return;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        fs: 1,
      },
      events: {
        onReady: (event: any) => {
          console.log('YouTube player ready');
          setPlayer(event.target);
          // Sync to current room state
          setTimeout(() => {
            if (room.current_video_time > 0) {
              event.target.seekTo(room.current_video_time, true);
            }
            if (room.is_playing) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          }, 500);
        },
        onStateChange: (event: any) => {
          console.log('Player state change:', event.data);
          // Update current time
          if (event.target && typeof event.target.getCurrentTime === 'function') {
            setCurrentTime(Math.floor(event.target.getCurrentTime()));
          }
          if (event.target && typeof event.target.getDuration === 'function') {
            setDuration(Math.floor(event.target.getDuration()));
          }
          // Only sync if this user initiated the change (not syncing from another user)
          if (!isSyncing && event.target) {
            handleVideoStateChange(event);
          }
        }
      }
    });
  }, [isYouTubeReady, room?.current_video_url]);

  const handleVideoStateChange = useCallback(async (event: any) => {
    if (!room || !event.target || isSyncing) return;
    
    const currentTime = Math.floor(event.target.getCurrentTime());
    const isPlaying = event.data === window.YT.PlayerState.PLAYING;
    const isPaused = event.data === window.YT.PlayerState.PAUSED;
    
    // Only sync for meaningful state changes
    if (!isPlaying && !isPaused) return;
    
    // Prevent feedback loops by checking if this is a user-initiated change
    if (Date.now() - (window as any).lastSyncTime < 2000) return;
    
    console.log('User initiated video state change:', { isPlaying, currentTime });
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          is_playing: isPlaying,
          current_video_time: currentTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', room.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error syncing video state:', error);
    }
  }, [room, isSyncing]);

  const syncVideoState = useCallback((newRoom: Room) => {
    if (!player || !newRoom.current_video_url || isSyncing) return;
    
    // Mark sync time to prevent feedback loops
    (window as any).lastSyncTime = Date.now();
    
    console.log('Syncing to room state:', { 
      isPlaying: newRoom.is_playing, 
      time: newRoom.current_video_time 
    });
    
    setIsSyncing(true);
    
    const currentTime = Math.floor(player.getCurrentTime());
    const timeDiff = Math.abs(currentTime - newRoom.current_video_time);
    
    // Always sync to exact position for better accuracy
    if (timeDiff > 2) {
      console.log('Seeking to:', newRoom.current_video_time);
      player.seekTo(newRoom.current_video_time, true);
    }
    
    // Sync play/pause state with more precise checks
    const currentState = player.getPlayerState();
    if (newRoom.is_playing && currentState !== window.YT.PlayerState.PLAYING) {
      console.log('Starting video playback');
      player.playVideo();
    } else if (!newRoom.is_playing && currentState === window.YT.PlayerState.PLAYING) {
      console.log('Pausing video playback');
      player.pauseVideo();
    }
    
    setTimeout(() => {
      setIsSyncing(false);
    }, 2000);
  }, [player, isSyncing]);

  const handlePlayPause = async () => {
    if (!room || !player) return;
    
    const currentTime = Math.floor(player.getCurrentTime());
    const newPlayingState = !room.is_playing;
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          is_playing: newPlayingState,
          current_video_time: currentTime
        })
        .eq('id', room.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating play state:', error);
    }
  };

  const handleSeek = async (seconds: number) => {
    if (!room || !player) return;
    
    const currentTime = Math.floor(player.getCurrentTime());
    const newTime = Math.max(0, currentTime + seconds);
    
    player.seekTo(newTime, true);
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          current_video_time: newTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', room.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!player) return;
    player.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!player) return;
    player.setVolume(newVolume);
    setVolume(newVolume);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressSeek = async (percentage: number) => {
    if (!room || !player || !duration) return;
    
    const newTime = Math.floor((percentage / 100) * duration);
    player.seekTo(newTime, true);
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          current_video_time: newTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', room.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  };

  const handleLoadVideo = async () => {
    if (!room) return;
    const url = newVideoUrl.trim();
    if (!url) return;
    
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      toast({ title: 'Invalid YouTube URL', description: 'Please enter a valid YouTube link.', variant: 'destructive' });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ current_video_url: url, is_playing: false, current_video_time: 0 })
        .eq('id', room.id);
      if (error) throw error;
      setRoom({ ...room, current_video_url: url, is_playing: false, current_video_time: 0 });
      toast({ title: 'Video loaded', description: 'Shared with the room.' });
      setNewVideoUrl('');
    } catch (e: any) {
      toast({ title: 'Failed to load video', description: e.message, variant: 'destructive' });
    }
  };

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
          console.log('Room update received:', payload);
          if (payload.eventType === 'UPDATE') {
            const newRoom = payload.new as Room;
            const oldRoom = payload.old as Room;
            
            // Only sync if there's an actual change in video state
            const hasVideoStateChange = 
              newRoom.is_playing !== oldRoom.is_playing ||
              Math.abs(newRoom.current_video_time - oldRoom.current_video_time) > 1 ||
              newRoom.current_video_url !== oldRoom.current_video_url;
            
            setRoom(newRoom);
            
            if (hasVideoStateChange && player) {
              syncVideoState(newRoom);
            }
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
            {room.current_video_url ? (
              <div className="space-y-4">
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black relative">
                  <div id="youtube-player" className="w-full h-full"></div>
                </div>
                
                {/* Video Controls */}
                <div className="bg-card rounded-lg border shadow-sm">
                  {/* Progress Bar */}
                  <div className="px-4 pt-4">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                      <span>{formatTime(currentTime)}</span>
                      <div className="flex-1">
                        <Slider
                          value={[duration ? (currentTime / duration) * 100 : 0]}
                          onValueChange={(value) => handleProgressSeek(value[0])}
                          max={100}
                          step={0.1}
                          className="cursor-pointer"
                          disabled={!player || !duration}
                        />
                      </div>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  
                  {/* Main Controls */}
                  <div className="flex items-center justify-between p-4">
                    {/* Left Controls */}
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSeek(-30)}
                        disabled={!player}
                        className="h-8 w-8 p-0"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSeek(-10)}
                        disabled={!player}
                        className="h-8 w-8 p-0"
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePlayPause}
                        disabled={!player}
                        className="h-10 w-10 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {room.is_playing ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSeek(10)}
                        disabled={!player}
                        className="h-8 w-8 p-0"
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSeek(30)}
                        disabled={!player}
                        className="h-8 w-8 p-0"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Center Controls */}
                    <div className="flex items-center space-x-4">
                      {/* Speed Control */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Speed:</span>
                        <Select
                          value={playbackRate.toString()}
                          onValueChange={(value) => handlePlaybackRateChange(parseFloat(value))}
                          disabled={!player}
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.25">0.25x</SelectItem>
                            <SelectItem value="0.5">0.5x</SelectItem>
                            <SelectItem value="0.75">0.75x</SelectItem>
                            <SelectItem value="1">1x</SelectItem>
                            <SelectItem value="1.25">1.25x</SelectItem>
                            <SelectItem value="1.5">1.5x</SelectItem>
                            <SelectItem value="1.75">1.75x</SelectItem>
                            <SelectItem value="2">2x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center space-x-2">
                      {/* Volume Control */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVolumeChange(volume === 0 ? 100 : 0)}
                          disabled={!player}
                          className="h-8 w-8 p-0"
                        >
                          {volume === 0 ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="w-20">
                          <Slider
                            value={[volume]}
                            onValueChange={(value) => handleVolumeChange(value[0])}
                            max={100}
                            step={1}
                            className="cursor-pointer"
                            disabled={!player}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{volume}%</span>
                      </div>

                      {/* Quality Control */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Quality:</span>
                        <Select
                          defaultValue="auto"
                          onValueChange={(quality) => {
                            if (player && quality !== 'auto') {
                              player.setPlaybackQuality(quality);
                            }
                          }}
                          disabled={!player}
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="hd1080">1080p</SelectItem>
                            <SelectItem value="hd720">720p</SelectItem>
                            <SelectItem value="large">480p</SelectItem>
                            <SelectItem value="medium">360p</SelectItem>
                            <SelectItem value="small">240p</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Fullscreen */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const iframe = document.getElementById('youtube-player');
                          if (iframe && (iframe as any).requestFullscreen) {
                            (iframe as any).requestFullscreen();
                          }
                        }}
                        disabled={!player}
                        className="h-8 w-8 p-0"
                      >
                        <Maximize className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Video URL Input */}
                <Card className="p-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                    />
                    <Button onClick={handleLoadVideo}>Load Video</Button>
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="p-6">
                <div className="text-center">
                  <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No video playing</h3>
                  <p className="text-muted-foreground mb-4">
                    Paste a YouTube link to start watching together
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                    />
                    <Button onClick={handleLoadVideo}>Load Video</Button>
                  </div>
                </div>
              </Card>
            )}
            
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