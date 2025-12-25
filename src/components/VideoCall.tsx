import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface VideoCallProps {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string | null;
  callType: "audio" | "video";
  isIncoming?: boolean;
  callId?: string;
  onEnd: () => void;
}

export const VideoCall = ({
  otherUserId,
  otherUserName,
  otherUserAvatar,
  callType,
  isIncoming = false,
  callId,
  onEnd,
}: VideoCallProps) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<"ringing" | "connecting" | "connected" | "ended">(
    isIncoming ? "ringing" : "connecting"
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [duration, setDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const currentCallId = useRef<string | null>(callId || null);

  useEffect(() => {
    if (!isIncoming) {
      initiateCall();
    }
    
    // Subscribe to call signaling updates
    const channel = supabase
      .channel("call-signaling")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_signaling",
        },
        async (payload) => {
          const data = payload.new as any;
          if (!data || !currentCallId.current) return;
          
          if (data.id === currentCallId.current) {
            if (data.status === "answered" && callStatus !== "connected") {
              await handleCallAnswered(data.signal_data);
            } else if (data.status === "declined" || data.status === "ended") {
              endCall();
            } else if (data.signal_data?.answer && peerConnection.current) {
              await peerConnection.current.setRemoteDescription(
                new RTCSessionDescription(data.signal_data.answer)
              );
              setCallStatus("connected");
            } else if (data.signal_data?.ice && peerConnection.current) {
              await peerConnection.current.addIceCandidate(
                new RTCIceCandidate(data.signal_data.ice)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      cleanup();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const initiateCall = async () => {
    try {
      // Create call record
      const { data: call, error } = await supabase
        .from("call_signaling")
        .insert({
          caller_id: user?.id,
          receiver_id: otherUserId,
          call_type: callType,
          status: "ringing",
        })
        .select()
        .single();

      if (error) throw error;
      currentCallId.current = call.id;

      await setupWebRTC(true);
    } catch (error) {
      console.error("Failed to initiate call:", error);
      onEnd();
    }
  };

  const setupWebRTC = async (isInitiator: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      localStream.current = stream;

      if (localVideoRef.current && callType === "video") {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      stream.getTracks().forEach((track) => {
        peerConnection.current?.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.current.onicecandidate = async (event) => {
        if (event.candidate && currentCallId.current) {
          await supabase
            .from("call_signaling")
            .update({
              signal_data: { ice: JSON.parse(JSON.stringify(event.candidate)) },
            })
            .eq("id", currentCallId.current);
        }
      };

      if (isInitiator) {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        await supabase
          .from("call_signaling")
          .update({
            signal_data: { offer: JSON.parse(JSON.stringify(offer)) },
          })
          .eq("id", currentCallId.current);
      }
    } catch (error) {
      console.error("WebRTC setup failed:", error);
      endCall();
    }
  };

  const handleCallAnswered = async (signalData: any) => {
    if (!peerConnection.current || !signalData?.offer) return;

    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(signalData.offer)
    );

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    await supabase
      .from("call_signaling")
      .update({
        status: "answered",
        signal_data: { ...signalData, answer },
      })
      .eq("id", currentCallId.current);

    setCallStatus("connected");
  };

  const answerCall = async () => {
    setCallStatus("connecting");
    await setupWebRTC(false);

    // Get the offer from the call
    const { data } = await supabase
      .from("call_signaling")
      .select("signal_data")
      .eq("id", currentCallId.current)
      .single();

    const signalData = data?.signal_data as Record<string, any> | null;
    if (signalData?.offer) {
      await handleCallAnswered(signalData);
    }
  };

  const declineCall = async () => {
    if (currentCallId.current) {
      await supabase
        .from("call_signaling")
        .update({ status: "declined" })
        .eq("id", currentCallId.current);
    }
    endCall();
  };

  const endCall = async () => {
    if (currentCallId.current) {
      await supabase
        .from("call_signaling")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", currentCallId.current);
    }
    cleanup();
    setCallStatus("ended");
    onEnd();
  };

  const cleanup = () => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    localStream.current = null;
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Main video area */}
      <div className="flex-1 relative bg-muted">
        {callType === "video" && callStatus === "connected" ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-lg shadow-lg"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Avatar className="w-32 h-32 mb-4">
              <AvatarImage src={otherUserAvatar || ""} />
              <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                {otherUserName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold text-foreground">{otherUserName}</h2>
            <p className="text-muted-foreground mt-2">
              {callStatus === "ringing" && (isIncoming ? "Incoming call..." : "Calling...")}
              {callStatus === "connecting" && "Connecting..."}
              {callStatus === "connected" && formatDuration(duration)}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-card safe-bottom">
        {callStatus === "ringing" && isIncoming ? (
          <div className="flex justify-center gap-8">
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full w-16 h-16"
              onClick={declineCall}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
              onClick={answerCall}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-center gap-6">
            <Button
              size="lg"
              variant={isMuted ? "destructive" : "secondary"}
              className="rounded-full w-14 h-14"
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            {callType === "video" && (
              <Button
                size="lg"
                variant={isVideoOff ? "destructive" : "secondary"}
                className="rounded-full w-14 h-14"
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full w-14 h-14"
              onClick={endCall}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
