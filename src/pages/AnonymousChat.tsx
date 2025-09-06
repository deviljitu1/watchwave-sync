import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle, Users, Send, Loader2, LogOut, Smile, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import EmojiPicker from 'emoji-picker-react';

interface Message {
  id: string;
  participantId: string;
  participantName: string;
  message: string;
  timestamp: number;
  type: 'text' | 'emoji';
}

interface Participant {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export default function AnonymousChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [participantId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [participantName, setParticipantName] = useState("");
  const [participantColor] = useState(() => `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomCode] = useState(() => Math.random().toString(36).substr(2, 6).toUpperCase());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Generate random participant name
    const names = ["Wanderer", "Dreamer", "Thinker", "Explorer", "Seeker", "Listener", "Helper", "Friend"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    setParticipantName(`${randomName}${randomNum}`);
    
    // Add self to participants
    const self: Participant = {
      id: participantId,
      name: `${randomName}${randomNum}`,
      color: participantColor,
      lastSeen: Date.now()
    };
    setParticipants([self]);
    setIsConnected(true);
    
    // Welcome message
    setTimeout(() => {
      const welcomeMessage: Message = {
        id: `msg_${Date.now()}`,
        participantId: 'system',
        participantName: 'System',
        message: `Welcome to Anonymous Chat! Your room code is: ${roomCode}`,
        timestamp: Date.now(),
        type: 'text'
      };
      setMessages([welcomeMessage]);
      toast.success("Connected to anonymous chat!");
    }, 500);

    // Simulate other participants joining occasionally
    const joinInterval = setInterval(() => {
      if (Math.random() > 0.7 && participants.length < 5) {
        const newParticipant: Participant = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 1000)}`,
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
          lastSeen: Date.now()
        };
        
        setParticipants(prev => [...prev, newParticipant]);
        
        const joinMessage: Message = {
          id: `msg_${Date.now()}`,
          participantId: 'system',
          participantName: 'System',
          message: `${newParticipant.name} joined the chat`,
          timestamp: Date.now(),
          type: 'text'
        };
        setMessages(prev => [...prev, joinMessage]);
      }
    }, 15000);

    return () => clearInterval(joinInterval);
  }, [participantId, participantColor, roomCode]);

  const sendMessage = () => {
    const content = newMessage.trim();
    if (!content || !isConnected) return;

    const message: Message = {
      id: `msg_${Date.now()}`,
      participantId,
      participantName,
      message: content,
      timestamp: Date.now(),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage("");
    setShowEmojiPicker(false);

    // Simulate responses from other participants occasionally
    if (Math.random() > 0.6 && participants.length > 1) {
      setTimeout(() => {
        const otherParticipant = participants[Math.floor(Math.random() * participants.length)];
        if (otherParticipant.id !== participantId) {
          const responses = [
            "That's interesting!",
            "I agree",
            "Haha nice",
            "What do you think?",
            "Cool!",
            "Thanks for sharing",
            "Good point"
          ];
          
          const responseMessage: Message = {
            id: `msg_${Date.now()}_response`,
            participantId: otherParticipant.id,
            participantName: otherParticipant.name,
            message: responses[Math.floor(Math.random() * responses.length)],
            timestamp: Date.now(),
            type: 'text'
          };
          setMessages(prev => [...prev, responseMessage]);
        }
      }, 1000 + Math.random() * 3000);
    }
  };

  const handleEmojiSelect = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const leaveChat = () => {
    setIsConnected(false);
    toast.info("Left the chat");
    navigate('/');
  };

  const getParticipantColor = (id: string) => {
    if (id === participantId) return participantColor;
    const participant = participants.find(p => p.id === id);
    return participant?.color || '#666';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Anonymous Chat</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">Room: {roomCode}</Badge>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{participants.length}</span>
            </Badge>
            <Button variant="outline" size="sm" onClick={leaveChat}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Participants Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Online ({participants.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] lg:h-[400px]">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: participant.color }}
                      />
                      <span className="text-sm font-medium">
                        {participant.name}
                        {participant.id === participantId && " (You)"}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-3 flex flex-col">
            <CardHeader>
              <CardTitle>Chat Messages</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 mb-4 h-[400px] lg:h-[500px]">
                <div className="space-y-3 p-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.participantId === participantId ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.participantId === participantId
                            ? 'bg-primary text-primary-foreground'
                            : message.participantId === 'system'
                            ? 'bg-muted text-muted-foreground text-center'
                            : 'bg-muted'
                        }`}
                      >
                        {message.participantId !== 'system' && message.participantId !== participantId && (
                          <div className="flex items-center space-x-2 mb-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getParticipantColor(message.participantId) }}
                            />
                            <span className="text-xs font-medium">{message.participantName}</span>
                          </div>
                        )}
                        <p className="text-sm">{message.message}</p>
                        <span className="text-xs opacity-70 mt-1 block">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              {isConnected ? (
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="pr-10"
                    />
                    <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="p-0 border-0">
                        <EmojiPicker onEmojiClick={handleEmojiSelect} />
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  <p>Connecting to chat...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}