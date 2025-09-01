import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LogIn, Loader2 } from 'lucide-react';
import { useRooms } from '@/hooks/useRooms';
import { useNavigate } from 'react-router-dom';

interface JoinRoomDialogProps {
  children?: React.ReactNode;
}

export function JoinRoomDialog({ children }: JoinRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { joinRoom } = useRooms();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setLoading(true);
    const { data: room, error } = await joinRoom(roomCode);
    
    if (!error && room) {
      setOpen(false);
      setRoomCode('');
      navigate(`/room/${room.room_code}`);
    }
    
    setLoading(false);
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to uppercase and limit to 6 characters
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCode(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full" size="lg">
            <LogIn className="mr-2 h-4 w-4" />
            Join Existing Room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Watch Room</DialogTitle>
          <DialogDescription>
            Enter the 6-character room code to join an existing watch party.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-code">Room Code</Label>
            <Input
              id="room-code"
              value={roomCode}
              onChange={handleRoomCodeChange}
              placeholder="ABC123"
              className="text-center text-lg font-mono tracking-wider"
              maxLength={6}
              required
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-character code shared by the room host
            </p>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || roomCode.length !== 6}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}