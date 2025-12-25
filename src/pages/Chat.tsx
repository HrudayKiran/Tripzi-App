import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Image, MapPin, Smile, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface Message {
  id: string;
  message: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);
  const MESSAGE_COOLDOWN_MS = 1000;

  useEffect(() => {
    if (user && userId) {
      fetchOtherUser();
      fetchMessages();
    }
  }, [user, userId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user || !userId) return;

    const channel = supabase
      .channel(`chat-${user.id}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's a message in this conversation
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === userId) ||
            (newMsg.sender_id === userId && newMsg.receiver_id === user.id)
          ) {
            setMessages((prev) => {
              // Check if message already exists
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Mark as read if from other user
            if (newMsg.sender_id === userId) {
              markMessagesAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchOtherUser = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setOtherUser(data);
    }
  };

  const fetchMessages = async () => {
    if (!user || !userId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages(data || []);
    markMessagesAsRead();
  };

  const markMessagesAsRead = async () => {
    if (!user || !userId) return;

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", userId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userId || !newMessage.trim() || sending) return;

    // Rate limiting check
    const now = Date.now();
    if (now - lastMessageTime.current < MESSAGE_COOLDOWN_MS) {
      toast({
        title: "Slow down",
        description: "Please wait a moment before sending another message",
        variant: "destructive",
      });
      return;
    }

    // Message length validation
    if (newMessage.length > 2000) {
      toast({
        title: "Message too long",
        description: "Messages must be less than 2000 characters",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          message: messageText,
        })
        .select()
        .single();

      if (error) throw error;

      // Add message to local state immediately
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }

      lastMessageTime.current = now;
    } catch (error: any) {
      setNewMessage(messageText); // Restore message on error
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isUserOnline = userId ? isOnline(userId) : false;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={otherUser?.avatar_url || ""} />
                <AvatarFallback className="bg-primary-foreground text-primary">
                  {otherUser?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {isUserOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-primary" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground">{otherUser?.full_name || "User"}</h1>
              <p className="text-xs text-primary-foreground/70">
                {isUserOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-primary-foreground">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground">
              <Video className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl p-3 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <Smile className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <Image className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 rounded-full"
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="rounded-full">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
