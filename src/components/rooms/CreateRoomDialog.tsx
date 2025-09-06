import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { useRooms } from '@/hooks/useRooms';
import { useNavigate } from 'react-router-dom';

interface CreateRoomDialogProps {
  children?: React.ReactNode;
}

export function CreateRoomDialog({ children }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [loading, setLoading] = useState(false);
  const { createRoom } = useRooms();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    console.log('Starting room creation with:', { name, description, maxParticipants });
    setLoading(true);
    try {
      const result = await createRoom(name, description, maxParticipants);
      console.log('Room creation result:', result);
      
      if (!result.error && result.data) {
        console.log('Room created successfully, navigating to:', `/room/${result.data.room_code}`);
        setOpen(false);
        setName('');
        setDescription('');
        setMaxParticipants(50);
        // Navigate to the room page
        navigate(`/room/${result.data.room_code}`);
      } else if (result.error) {
        console.error('Room creation error:', result.error);
      }
    } catch (err) {
      console.error('Unexpected error creating room:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create New Room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Watch Room</DialogTitle>
          <DialogDescription>
            Create a new room to watch videos with friends. Share the room code to invite others.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Room Name *</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Movie Night with Friends"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-description">Description</Label>
            <Textarea
              id="room-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you watching tonight?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-participants">Max Participants</Label>
            <Input
              id="max-participants"
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Math.min(100, Math.max(2, parseInt(e.target.value) || 2)))}
              min="2"
              max="100"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}