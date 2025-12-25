import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, MapPin, Calendar, Heart, MessageCircle, Share2, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Trip {
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
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Booking {
  id: string;
  user_id: string;
  trip_id: string;
  created_at: string;
  status: string;
  profile?: Profile;
}

const Feed = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const [tripBookings, setTripBookings] = useState<Record<string, Booking[]>>({});
  const [tripLikes, setTripLikes] = useState<Record<string, number>>({});
  const [tripComments, setTripComments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);
  const [selectedTripBookings, setSelectedTripBookings] = useState<Booking[]>([]);
  const [showBookingsSheet, setShowBookingsSheet] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyTrips();
    }

    const channel = supabase
      .channel("feed-my-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => user && fetchMyTrips())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => user && fetchMyTrips())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMyTrips = async () => {
    if (!user) return;
    
    try {
      // Fetch only current user's trips
      const { data: tripsData, error } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (tripsData) {
        const tripIds = tripsData.map((t) => t.id);
        
        if (tripIds.length > 0) {
          // Fetch images
          const { data: imagesData } = await supabase
            .from("trip_images")
            .select("trip_id, image_url")
            .in("trip_id", tripIds);

          if (imagesData) {
            const imagesMap: Record<string, string> = {};
            imagesData.forEach((img) => {
              if (!imagesMap[img.trip_id]) imagesMap[img.trip_id] = img.image_url;
            });
            setTripImages(imagesMap);
          }

          // Fetch bookings with profiles
          const { data: bookingsData } = await supabase
            .from("bookings")
            .select("*")
            .in("trip_id", tripIds)
            .eq("status", "confirmed");

          if (bookingsData && bookingsData.length > 0) {
            const bookerIds = [...new Set(bookingsData.map((b) => b.user_id))];
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .in("id", bookerIds);

            const profilesMap: Record<string, Profile> = {};
            profilesData?.forEach((p) => {
              profilesMap[p.id] = p;
            });

            const bookingsMap: Record<string, Booking[]> = {};
            bookingsData.forEach((b) => {
              if (!bookingsMap[b.trip_id]) bookingsMap[b.trip_id] = [];
              bookingsMap[b.trip_id].push({
                ...b,
                profile: profilesMap[b.user_id],
              });
            });
            setTripBookings(bookingsMap);
          }

          // Fetch likes count
          const { data: likesData } = await supabase
            .from("trip_likes")
            .select("trip_id")
            .in("trip_id", tripIds);

          if (likesData) {
            const likesMap: Record<string, number> = {};
            likesData.forEach((l) => {
              likesMap[l.trip_id] = (likesMap[l.trip_id] || 0) + 1;
            });
            setTripLikes(likesMap);
          }

          // Fetch comments count
          const { data: commentsData } = await supabase
            .from("trip_comments")
            .select("trip_id")
            .in("trip_id", tripIds);

          if (commentsData) {
            const commentsMap: Record<string, number> = {};
            commentsData.forEach((c) => {
              commentsMap[c.trip_id] = (commentsMap[c.trip_id] || 0) + 1;
            });
            setTripComments(commentsMap);
          }
        }
        
        setTrips(tripsData);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load trips", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripToDelete);
      if (error) throw error;
      setTrips(trips.filter((t) => t.id !== tripToDelete));
      toast({ title: "Success", description: "Trip deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete trip", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setTripToDelete(null);
    }
  };

  const openDeleteDialog = (tripId: string) => {
    setTripToDelete(tripId);
    setDeleteDialogOpen(true);
  };

  const handleShare = async (trip: Trip) => {
    const url = `${window.location.origin}/trip/${trip.id}`;
    const text = `Check out this trip to ${trip.destination}!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text, url });
        return;
      } catch {}
    }
    
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast({ title: "Link copied!", description: "Trip link copied to clipboard. Paste it in WhatsApp, Instagram, or any app!" });
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = `${text}\n${url}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
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

  const showBookings = (bookings: Booking[]) => {
    setSelectedTripBookings(bookings);
    setShowBookingsSheet(true);
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 safe-top border-b border-border/30">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            My Trips
          </h1>
          <Button variant="default" size="sm" onClick={() => navigate("/create-trip")} className="rounded-full">
            + Create Trip
          </Button>
        </div>
      </div>

      {/* Feed - Only My Trips */}
      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <MapPin className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium mb-2">No trips yet</p>
            <p className="text-sm mb-6">Create your first trip to start exploring!</p>
            <Button onClick={() => navigate("/create-trip")} className="rounded-full px-6">
              Create Trip
            </Button>
          </div>
        ) : (
          trips.map((trip, index) => {
            const bookings = tripBookings[trip.id] || [];
            const likes = tripLikes[trip.id] || 0;
            const comments = tripComments[trip.id] || 0;
            
            return (
              <article
                key={trip.id}
                className="bg-card rounded-3xl overflow-hidden shadow-card animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Author header - showing user's own profile */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                        {profile?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{profile?.full_name || "You"}</p>
                      <p className="text-xs text-muted-foreground">{getTimeAgo(trip.created_at)}</p>
                    </div>
                  </div>

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
                        onClick={() => openDeleteDialog(trip.id)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Trip image */}
                <div className="relative cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                  <div className="aspect-[4/3] bg-muted">
                    {tripImages[trip.id] ? (
                      <img src={tripImages[trip.id]} alt={trip.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <MapPin className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                  </div>
                  <Badge className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground font-bold shadow-lg">
                    {formatINR(trip.cost)}
                  </Badge>
                </div>

                {/* Trip details */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-lg">{trip.destination}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(trip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
                        {new Date(trip.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">{trip.description}</p>

                  {/* Stats Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Heart className="h-5 w-5" />
                        <span className="text-sm font-medium">{likes}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">{comments}</span>
                      </div>
                      <button
                        onClick={() => handleShare(trip)}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-all"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Joiners info */}
                    <button
                      onClick={() => showBookings(bookings)}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
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
                        <Users className="h-4 w-4 inline mr-1" />
                        {bookings.length} joined
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Bookings Sheet */}
      <Sheet open={showBookingsSheet} onOpenChange={setShowBookingsSheet}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>People who joined this trip</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3 overflow-y-auto">
            {selectedTripBookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No one has joined yet</p>
            ) : (
              selectedTripBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    setShowBookingsSheet(false);
                    navigate(`/profile/${booking.user_id}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={booking.profile?.avatar_url || ""} />
                      <AvatarFallback>{booking.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{booking.profile?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">Joined {getTimeAgo(booking.created_at)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full">
                    View Profile
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your trip.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrip} className="rounded-xl bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Feed;
