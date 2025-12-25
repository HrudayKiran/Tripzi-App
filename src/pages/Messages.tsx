import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { StoriesBar } from "@/components/StoriesBar";

interface Conversation {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  trip_title?: string;
}

const Messages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      // Get all messages where user is sender or receiver
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          id,
          message,
          created_at,
          is_read,
          sender_id,
          receiver_id,
          trip_id
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const conversationMap = new Map<string, any>();
      
      for (const msg of messages || []) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user_id: partnerId,
            last_message: msg.message,
            last_message_time: msg.created_at,
            unread_count: msg.receiver_id === user.id && !msg.is_read ? 1 : 0,
            trip_id: msg.trip_id
          });
        } else if (msg.receiver_id === user.id && !msg.is_read) {
          conversationMap.get(partnerId).unread_count++;
        }
      }

      // Fetch user profiles for each conversation
      const partnerIds = Array.from(conversationMap.keys());
      
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", partnerIds);

        const conversationList: Conversation[] = [];
        
        for (const [partnerId, conv] of conversationMap.entries()) {
          const profile = profiles?.find(p => p.id === partnerId);
          
          conversationList.push({
            ...conv,
            full_name: profile?.full_name || "Unknown User",
            avatar_url: profile?.avatar_url || null,
          });
        }

        setConversations(conversationList);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          
          {/* Stories Bar */}
          <StoriesBar />
          
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="divide-y">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start a conversation by messaging a trip organizer
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.user_id}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
              onClick={() => navigate(`/chat/${conv.user_id}`)}
            >
              <Avatar className="h-14 w-14">
                <AvatarImage src={conv.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10">
                  {conv.full_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{conv.full_name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>
              </div>
              {conv.unread_count > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
