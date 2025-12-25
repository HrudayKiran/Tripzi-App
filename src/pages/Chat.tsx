import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, MapPin, Phone, Video, Trash2, MoreVertical, Plus, X, Edit2, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { VideoCall } from "@/components/VideoCall";
import { LocationPreview } from "@/components/LocationPreview";

interface Message {
  id: string;
  message: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  status?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, profile: userProfile } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { isOtherUserTyping, handleTyping, setTyping } = useTypingIndicator(userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; messageId: string | null }>({ open: false, messageId: null });
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [showLocationPreview, setShowLocationPreview] = useState(false);
  const [activeCall, setActiveCall] = useState<{ type: "audio" | "video" } | null>(null);
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
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            return;
          }
          
          if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => prev.map((m) => m.id === updatedMsg.id ? updatedMsg : m));
            return;
          }
          
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

  // Cleanup typing indicator on unmount
  useEffect(() => {
    return () => {
      setTyping(false);
    };
  }, [setTyping]);

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
      .update({ is_read: true, status: 'read' })
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
    if (editingMessage) {
      setEditingMessage({ ...editingMessage, text: editingMessage.text + emojiData.emoji });
    } else {
      setNewMessage((prev) => prev + emojiData.emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async () => {
    if (!deleteDialog.messageId) return;
    
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", deleteDialog.messageId)
        .eq("sender_id", user?.id);
      
      if (error) throw error;
      
      setMessages((prev) => prev.filter((m) => m.id !== deleteDialog.messageId));
      // No toast for delete - silent operation
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    } finally {
      setDeleteDialog({ open: false, messageId: null });
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editingMessage.text.trim()) return;
    
    try {
      const { error } = await supabase
        .from("messages")
        .update({ message: editingMessage.text.trim() })
        .eq("id", editingMessage.id)
        .eq("sender_id", user?.id);
      
      if (error) throw error;
      
      setMessages((prev) => prev.map((m) => 
        m.id === editingMessage.id ? { ...m, message: editingMessage.text.trim() } : m
      ));
      setEditingMessage(null);
      // No toast for edit - silent operation
    } catch (error) {
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    if (!user || !userId) return;

    const maxSize = type === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${type === 'image' ? '5MB' : '10MB'}`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setShowAttachMenu(false);
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

      const messageText = type === 'image' 
        ? `📷 [Image] ${urlData.publicUrl}`
        : `📎 [Document: ${file.name}] ${urlData.publicUrl}`;

      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          message: messageText,
          status: 'sent',
        });

      if (error) throw error;
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

    const now = Date.now();
    if (now - lastMessageTime.current < MESSAGE_COOLDOWN_MS) {
      toast({
        title: "Slow down",
        description: "Please wait a moment before sending another message",
        variant: "destructive",
      });
      return;
    }

    if (newMessage.length > 2000) {
      toast({
        title: "Message too long",
        description: "Messages must be less than 2000 characters",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setTyping(false);
    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          message: messageText,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }

      lastMessageTime.current = now;
      
      // Send push notification to receiver
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userId: userId,
          title: `New message from ${userProfile?.full_name || "Someone"}`,
          body: messageText.length > 50 ? messageText.substring(0, 50) + "..." : messageText,
          data: { type: "new_message", userId: user.id },
        },
      });
    } catch (error: any) {
      setNewMessage(messageText);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
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
            className="flex items-center gap-2 p-3 bg-background/20 rounded-lg hover:bg-background/30 transition-colors"
          >
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs opacity-70">Tap to open</p>
            </div>
          </a>
        );
      }
    }
    // Check if it's a location message
    if (message.startsWith('📍 [Location]')) {
      const url = message.replace('📍 [Location] ', '');
      const coords = url.match(/q=([^,]+),([^&]+)/);
      const lat = coords ? coords[1] : '';
      const lng = coords ? coords[2] : '';
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden"
        >
          <div className="w-[200px] h-[120px] relative overflow-hidden rounded-lg">
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.005},${parseFloat(lat) - 0.005},${parseFloat(lng) + 0.005},${parseFloat(lat) + 0.005}&layer=mapnik&marker=${lat},${lng}`}
              className="w-full h-full border-0 pointer-events-none"
              title="Location"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between p-2">
              <span className="text-xs text-white font-medium">📍 View in Maps</span>
            </div>
          </div>
        </a>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{message}</p>;
  };

  const handleShareLocation = async (lat: number, lng: number) => {
    if (!user || !userId) return;

    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const messageText = `📍 [Location] ${mapsUrl}`;

    try {
      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          message: messageText,
          status: 'sent',
        });

      if (error) throw error;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to share location",
        variant: "destructive",
      });
    }
  };

  const startCall = (type: "audio" | "video") => {
    setActiveCall({ type });
  };

  const endCall = () => {
    setActiveCall(null);
  };

  const isUserOnline = userId ? isOnline(userId) : false;

  // Render message status ticks
  const renderMessageStatus = (message: Message) => {
    const isOwn = message.sender_id === user?.id;
    if (!isOwn) return null;

    const status = message.status || (message.is_read ? 'read' : 'sent');

    if (status === 'read') {
      return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
    } else if (isUserOnline || status === 'delivered') {
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/70" />;
    } else {
      return <Check className="h-3.5 w-3.5 text-muted-foreground/70" />;
    }
  };

  if (activeCall) {
    return (
      <VideoCall
        otherUserId={userId!}
        otherUserName={otherUser?.full_name || "User"}
        otherUserAvatar={otherUser?.avatar_url}
        callType={activeCall.type}
        onEnd={endCall}
      />
    );
  }

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

      {/* Location Preview Dialog */}
      <LocationPreview
        open={showLocationPreview}
        onClose={() => setShowLocationPreview(false)}
        onSend={handleShareLocation}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg safe-top">
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
                {isOtherUserTyping ? "typing..." : isUserOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => startCall("audio")}>
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => startCall("video")}>
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
                  <div className="relative group max-w-[75%]">
                    <div
                      className={`rounded-2xl p-3 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card rounded-bl-sm'
                      }`}
                    >
                      {editingMessage?.id === message.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingMessage.text}
                            onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                            className="flex-1 h-8 text-sm bg-background/20 border-none"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleEditMessage}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMessage(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        renderMessageContent(message.message)
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatTime(message.created_at)}
                        </span>
                        {renderMessageStatus(message)}
                      </div>
                    </div>
                    {isOwn && !editingMessage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-muted hover:bg-muted/80"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => setEditingMessage({ id: message.id, text: message.message })}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteDialog({ open: true, messageId: message.id })}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing indicator */}
          {isOtherUserTyping && (
            <div className="flex justify-start">
              <div className="bg-card rounded-2xl rounded-bl-sm px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background safe-bottom">
        <div className="flex items-center gap-2">
          {/* Attachment Menu - WhatsApp style */}
          <Popover open={showAttachMenu} onOpenChange={setShowAttachMenu}>
            <PopoverTrigger asChild>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                disabled={uploading}
              >
                {showAttachMenu ? (
                  <X className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" side="top" align="start">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">📷</span>
                  </div>
                  <span className="text-xs">Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">📄</span>
                  </div>
                  <span className="text-xs">Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowLocationPreview(true);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-xs">Location</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Emoji Picker */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0">
                <span className="text-xl">😊</span>
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

          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            className="flex-1 rounded-full"
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="rounded-full">
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {uploading && (
          <p className="text-xs text-muted-foreground mt-2 text-center">Uploading...</p>
        )}
      </form>

      {/* Delete Message Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, messageId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;
