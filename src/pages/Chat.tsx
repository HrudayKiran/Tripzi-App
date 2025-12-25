import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Image, MapPin, Smile, Phone, Video, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    if (!user || !userId) return;

    const maxSize = type === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for images, 10MB for docs
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${type === 'image' ? '5MB' : '10MB'}`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = type === 'image' ? 'trip-images' : 'kyc-documents';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // Send message with file
      const messageText = type === 'image' 
        ? `📷 [Image] ${urlData.publicUrl}`
        : `📎 [Document: ${file.name}] ${urlData.publicUrl}`;

      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          message: messageText,
        });

      if (error) throw error;

      toast({
        title: "Sent",
        description: `${type === 'image' ? 'Image' : 'Document'} sent successfully`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: `Failed to send ${type}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

  const renderMessageContent = (message: string) => {
    // Check if it's an image message
    if (message.startsWith('📷 [Image]')) {
      const url = message.replace('📷 [Image] ', '');
      return (
        <img 
          src={url} 
          alt="Shared image" 
          className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
      );
    }
    // Check if it's a document message
    if (message.startsWith('📎 [Document:')) {
      const match = message.match(/📎 \[Document: (.+?)\] (.+)/);
      if (match) {
        const [, fileName, url] = match;
        return (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background/10 rounded-lg hover:bg-background/20 transition-colors"
          >
            <FileText className="h-5 w-5" />
            <span className="text-sm underline">{fileName}</span>
          </a>
        );
      }
    }
    // Check if it's a location message
    if (message.startsWith('📍 [Location]')) {
      const url = message.replace('📍 [Location] ', '');
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-background/10 rounded-lg hover:bg-background/20 transition-colors"
        >
          <MapPin className="h-5 w-5" />
          <span className="text-sm underline">View Location</span>
        </a>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{message}</p>;
  };

  const handleShareLocation = async () => {
    if (!user || !userId) return;

    if (!navigator.geolocation) {
      toast({
        title: "Not supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const messageText = `📍 [Location] ${mapsUrl}`;

        try {
          const { error } = await supabase
            .from("messages")
            .insert({
              sender_id: user.id,
              receiver_id: userId,
              message: messageText,
            });

          if (error) throw error;

          toast({
            title: "Sent",
            description: "Location shared successfully",
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to share location",
            variant: "destructive",
          });
        }
      },
      (error) => {
        toast({
          title: "Error",
          description: "Failed to get your location",
          variant: "destructive",
        });
      }
    );
  };

  const isUserOnline = userId ? isOnline(userId) : false;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'image');
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={docInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'document');
          e.target.value = '';
        }}
      />

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
                    {renderMessageContent(message.message)}
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

      {/* Uploading indicator */}
      {uploading && (
        <div className="px-4 py-2 bg-muted/50 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Uploading...</span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background">
        <div className="flex items-center gap-2">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 border-none" side="top" align="start">
              <EmojiPicker 
                onEmojiClick={handleEmojiClick} 
                theme={Theme.AUTO}
                width="100%"
                height={350}
              />
            </PopoverContent>
          </Popover>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Image className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={() => docInputRef.current?.click()}
            disabled={uploading}
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={handleShareLocation}
          >
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
