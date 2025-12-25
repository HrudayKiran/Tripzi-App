import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MapPin, Calendar, Edit, Trash2, Send, MoreHorizontal, Check, ShieldAlert, Users, UserPlus, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";

interface TripPostProps {
  trip: {
    id: string;
    title: string;
    description: string;
    destination: string;
    cost: number;
    start_date: string;
    end_date: string;
    max_travelers: number;
    current_travelers: number;
    created_at: string;
    user_id: string;
    gender_preference?: string | null;
    transport_type?: string | null;
    essentials?: string[] | null;
    location_url?: string | null;
  };
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  imageUrl: string | null;
  onDelete?: (tripId: string) => void;
  index?: number;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
}

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Booking {
  id: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const TripPost = ({ trip, profile, imageUrl, onDelete, index = 0, isFollowing = false, onFollowToggle }: TripPostProps) => {
  const navigate = useNavigate();
  const { user, profile: userProfile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookings, setShowBookings] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isOwner = user?.id === trip.user_id;
  const isVerified = userProfile?.kyc_status === 'verified';

  useEffect(() => {
    fetchLikes();
    fetchComments();
    checkIfJoined();
    fetchBookings();
  }, [trip.id, user]);

  // Set up real-time subscriptions for this trip
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_likes", filter: `trip_id=eq.${trip.id}` }, () => fetchLikes())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_comments", filter: `trip_id=eq.${trip.id}` }, () => fetchComments())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `trip_id=eq.${trip.id}` }, () => {
        fetchBookings();
        checkIfJoined();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trip.id]);

  const fetchLikes = async () => {
    const { count } = await supabase
      .from("trip_likes")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", trip.id);
    
    setLikesCount(count || 0);

    if (user) {
      const { data } = await supabase
        .from("trip_likes")
        .select("id")
        .eq("trip_id", trip.id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      setIsLiked(!!data);
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("trip_comments")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        profilesData?.forEach((p) => {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });

        setComments(
          data.map((c) => ({
            ...c,
            profile: profilesMap[c.user_id],
          }))
        );
      } else {
        setComments(data);
      }
    }
  };

  const fetchBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("id, user_id")
      .eq("trip_id", trip.id)
      .eq("status", "confirmed");

    if (data && data.length > 0) {
      const userIds = data.map((b) => b.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      profilesData?.forEach((p) => {
        profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      });

      setBookings(
        data.map((b) => ({
          ...b,
          profile: profilesMap[b.user_id],
        }))
      );
    } else {
      setBookings([]);
    }
  };

  const checkIfJoined = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .eq("trip_id", trip.id)
      .eq("user_id", user.id)
      .maybeSingle();
    
    setHasJoined(!!data);
  };

  const handleJoinTrip = async () => {
    if (!user) {
      toast({ title: "Please log in", description: "You need to be logged in to join trips" });
      return;
    }

    // Check KYC status
    if (!isVerified) {
      toast({ 
        title: "Verification Required", 
        description: "You need to complete KYC verification to join trips. This is required for safety.", 
        variant: "destructive" 
      });
      navigate('/profile');
      return;
    }

    if (hasJoined) {
      toast({ title: "Already joined", description: "You have already joined this trip" });
      return;
    }

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("book_trip", {
        p_trip_id: trip.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string };
      
      if (result.error) {
        toast({ title: "Cannot join", description: result.error, variant: "destructive" });
        return;
      }

      setHasJoined(true);
      
      // Send push notification to trip owner
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userId: trip.user_id,
          title: "New Trip Booking!",
          body: `${userProfile?.full_name || "Someone"} joined your trip to ${trip.destination}`,
          data: { type: "booking", tripId: trip.id },
        },
      });
      
      toast({ title: "Trip Joined!", description: `You've joined the trip to ${trip.destination}` });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to join trip", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast({ title: "Please log in", description: "You need to be logged in to like trips" });
      return;
    }

    setLoadingLike(true);
    try {
      if (isLiked) {
        await supabase
          .from("trip_likes")
          .delete()
          .eq("trip_id", trip.id)
          .eq("user_id", user.id);
        setIsLiked(false);
        setLikesCount((prev) => prev - 1);
      } else {
        await supabase
          .from("trip_likes")
          .insert({ trip_id: trip.id, user_id: user.id });
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setLoadingLike(false);
    }
  };

  const handleComment = async () => {
    if (!user || !newComment.trim()) return;

    try {
      await supabase.from("trip_comments").insert({
        trip_id: trip.id,
        user_id: user.id,
        comment: newComment.trim(),
      });
      setNewComment("");
      fetchComments();
    } catch (error) {
      toast({ title: "Error", description: "Failed to post comment", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/trip/${trip.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text: `Check out this trip to ${trip.destination}!`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Trip link copied to clipboard" });
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getDuration = () => {
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  return (
    <article
      className="bg-card rounded-3xl overflow-hidden shadow-card animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Author header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar
            className="w-10 h-10 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${trip.user_id}`);
            }}
          >
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              {profile?.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <p
                className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${trip.user_id}`);
                }}
              >
                {profile?.full_name || "Traveler"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{getTimeAgo(trip.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Follow button - only show if not owner */}
          {!isOwner && user && (
            <Button
              variant={isFollowing ? "secondary" : "outline"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onFollowToggle?.();
              }}
              className="rounded-full h-8 px-3 gap-1"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="text-xs">Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="text-xs">Follow</span>
                </>
              )}
            </Button>
          )}
          
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => navigate(`/create-trip/${trip.id}`)} className="gap-2">
                  <Edit className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(trip.id)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Trip image */}
      <div className="relative">
        <div className="aspect-[4/3] bg-muted">
          {imageUrl ? (
            <img src={imageUrl} alt={trip.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <MapPin className="h-12 w-12 text-primary/40" />
            </div>
          )}
        </div>
        <Badge className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground font-bold shadow-lg">
          {formatINR(trip.cost)}
        </Badge>
        <Badge className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground shadow-lg">
          {getDuration()}
        </Badge>
      </div>

      {/* Trip details */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg">{trip.title || trip.destination}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{trip.destination}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(trip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
              {new Date(trip.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        <p className={`text-sm text-muted-foreground ${!expanded && trip.description.length > 150 ? "line-clamp-2" : ""}`}>
          {trip.description}
        </p>
        {trip.description.length > 150 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary font-medium">
            {expanded ? "Show less" : "Read more"}
          </button>
        )}

        {/* Additional trip details */}
        <div className="flex flex-wrap gap-2">
          {trip.gender_preference && trip.gender_preference !== 'both' && (
            <Badge variant="secondary" className="text-xs">{trip.gender_preference} only</Badge>
          )}
          {trip.transport_type && (
            <Badge variant="outline" className="text-xs capitalize">{trip.transport_type}</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {trip.current_travelers}/{trip.max_travelers} travelers
          </Badge>
        </div>

        {/* Essentials */}
        {trip.essentials && trip.essentials.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trip.essentials.slice(0, 5).map((item, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs bg-muted">
                {item}
              </Badge>
            ))}
            {trip.essentials.length > 5 && (
              <Badge variant="secondary" className="text-xs bg-muted">
                +{trip.essentials.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {/* Joiners */}
        {bookings.length > 0 && (
          <Sheet open={showBookings} onOpenChange={setShowBookings}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                <div className="flex -space-x-2">
                  {bookings.slice(0, 3).map((booking) => (
                    <Avatar key={booking.id} className="w-6 h-6 border-2 border-card">
                      <AvatarImage src={booking.profile?.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">
                        {booking.profile?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-muted-foreground">
                  {bookings.length} joined
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[50vh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>People who joined</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-3 overflow-y-auto">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => {
                      setShowBookings(false);
                      navigate(`/profile/${booking.user_id}`);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={booking.profile?.avatar_url || ""} />
                      <AvatarFallback>{booking.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{booking.profile?.full_name || "User"}</p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={loadingLike}
              className={`flex items-center gap-1.5 transition-all hover:scale-110 ${isLiked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
            >
              <Heart className={`h-6 w-6 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{likesCount}</span>
            </button>

            <Sheet open={showComments} onOpenChange={setShowComments}>
              <SheetTrigger asChild>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-all hover:scale-110">
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-sm font-medium">{comments.length}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Comments</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No comments yet. Be the first!</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={comment.profile?.avatar_url || ""} />
                            <AvatarFallback className="text-xs">
                              {comment.profile?.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{comment.profile?.full_name || "User"}</span>
                              <span className="text-xs text-muted-foreground">{getTimeAgo(comment.created_at)}</span>
                            </div>
                            <p className="text-sm">{comment.comment}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {user && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Input
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleComment()}
                        className="rounded-full"
                      />
                      <Button onClick={handleComment} size="icon" className="rounded-full shrink-0">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-all hover:scale-110"
            >
              <Share2 className="h-6 w-6" />
            </button>
          </div>

          {/* Join button */}
          {!isOwner && (
            hasJoined ? (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full px-5 gap-2"
                disabled
              >
                <Check className="h-4 w-4" /> Joined
              </Button>
            ) : !isVerified ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleJoinTrip}
                className="rounded-full px-4 gap-2 border-amber-500 text-amber-600"
              >
                <ShieldAlert className="h-4 w-4" /> Verify to Join
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleJoinTrip}
                className="rounded-full px-5 shadow-lg hover:shadow-primary/25"
                disabled={trip.current_travelers >= trip.max_travelers || joining}
              >
                {trip.current_travelers >= trip.max_travelers ? "Full" : joining ? "Joining..." : "Join Trip"}
              </Button>
            )
          )}
        </div>
      </div>
    </article>
  );
};
