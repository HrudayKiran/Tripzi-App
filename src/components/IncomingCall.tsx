import { useEffect, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoCall } from "./VideoCall";

interface IncomingCallData {
  id: string;
  caller_id: string;
  call_type: "audio" | "video";
  caller_name?: string;
  caller_avatar?: string;
}

export const IncomingCallListener = () => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [showCall, setShowCall] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signaling",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as any;
          if (call.status === "ringing") {
            // Fetch caller info
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", call.caller_id)
              .single();

            setIncomingCall({
              id: call.id,
              caller_id: call.caller_id,
              call_type: call.call_type,
              caller_name: profile?.full_name || "Unknown",
              caller_avatar: profile?.avatar_url,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAnswer = () => {
    setShowCall(true);
  };

  const handleDecline = async () => {
    if (incomingCall) {
      await supabase
        .from("call_signaling")
        .update({ status: "declined" })
        .eq("id", incomingCall.id);
      setIncomingCall(null);
    }
  };

  const handleCallEnd = () => {
    setShowCall(false);
    setIncomingCall(null);
  };

  if (showCall && incomingCall) {
    return (
      <VideoCall
        otherUserId={incomingCall.caller_id}
        otherUserName={incomingCall.caller_name || "Unknown"}
        otherUserAvatar={incomingCall.caller_avatar}
        callType={incomingCall.call_type}
        isIncoming={true}
        callId={incomingCall.id}
        onEnd={handleCallEnd}
      />
    );
  }

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center space-y-6 animate-fade-up">
        <Avatar className="w-24 h-24 mx-auto ring-4 ring-primary animate-pulse">
          <AvatarImage src={incomingCall.caller_avatar || ""} />
          <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
            {incomingCall.caller_name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <h2 className="text-2xl font-bold">{incomingCall.caller_name}</h2>
          <p className="text-muted-foreground flex items-center justify-center gap-2 mt-1">
            {incomingCall.call_type === "video" ? (
              <>
                <Video className="h-4 w-4" /> Video Call
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" /> Voice Call
              </>
            )}
          </p>
        </div>

        <div className="flex justify-center gap-8">
          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
            onClick={handleDecline}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="lg"
            className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600 animate-pulse"
            onClick={handleAnswer}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};
