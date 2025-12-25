import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTypingIndicator = (chatWithUserId: string | undefined) => {
  const { user } = useAuth();
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for other user's typing status
  useEffect(() => {
    if (!user || !chatWithUserId) return;

    const channel = supabase
      .channel(`typing-${chatWithUserId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `user_id=eq.${chatWithUserId}`,
        },
        (payload) => {
          const data = payload.new as any;
          if (data?.chat_with === user.id) {
            setIsOtherUserTyping(data.is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, chatWithUserId]);

  // Update our typing status
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!user || !chatWithUserId) return;

      try {
        await supabase.from("typing_indicators").upsert(
          {
            user_id: user.id,
            chat_with: chatWithUserId,
            is_typing: isTyping,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,chat_with",
          }
        );
      } catch (error) {
        console.error("Failed to update typing status:", error);
      }
    },
    [user, chatWithUserId]
  );

  // Auto-clear typing status after delay
  const handleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setTyping(true);

    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 3000);
  }, [setTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setTyping(false);
    };
  }, [setTyping]);

  return { isOtherUserTyping, handleTyping, setTyping };
};
