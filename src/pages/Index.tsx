import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { JoinRoomDialog } from '@/components/rooms/JoinRoomDialog';
import { Video, Plus, LogIn, LogOut, User, MessageCircle } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Watch Together</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.user_metadata?.display_name || user.user_metadata?.username || 'User'}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome to Watch Together</h2>
            <p className="text-lg text-muted-foreground">
              Create a room to watch videos with friends or join an existing one
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Create Room</span>
                </CardTitle>
                <CardDescription>
                  Start a new watch party and invite your friends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateRoomDialog />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <LogIn className="h-5 w-5" />
                  <span>Join Room</span>
                </CardTitle>
                <CardDescription>
                  Enter a room code to join an existing watch party
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JoinRoomDialog />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Anonymous Chat</span>
                </CardTitle>
                <CardDescription>
                  Join anonymous chat rooms without signing up
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/anonymous-chat')}
                  variant="outline"
                >
                  Start Chatting
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Section */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-8">Features</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Synchronized Playback</h4>
                <p className="text-sm text-muted-foreground">
                  Watch videos in perfect sync with your friends
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Real-time Chat</h4>
                <p className="text-sm text-muted-foreground">
                  Chat with friends while watching together
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Easy Room Creation</h4>
                <p className="text-sm text-muted-foreground">
                  Create and share rooms with a simple link
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;