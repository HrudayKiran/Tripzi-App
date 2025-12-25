import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MapPin, Plus, Calendar, Users, Edit, Trash2, Car, Plane, Bus, Train, Search, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  gender_preference: string | null;
  transport_type: string | null;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllTrips();
    
    const channel = supabase
      .channel("feed-all-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => fetchAllTrips())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAllTrips = async () => {
    try {
      const { data: tripsData, error } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (tripsData) {
        const userIds = [...new Set(tripsData.map((t) => t.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesData) {
          const map: Record<string, Profile> = {};
          profilesData.forEach((p) => { map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
          setProfiles(map);
        }

        const tripIds = tripsData.map((t) => t.id);
        if (tripIds.length > 0) {
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
        }
        setTrips(tripsData);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load trips", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
      setTrips(trips.filter((t) => t.id !== tripId));
      toast({ title: "Success", description: "Trip deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete trip", variant: "destructive" });
    }
  };

  const handleShare = async (trip: Trip) => {
    const url = `${window.location.origin}/trip/${trip.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: trip.title, text: `Check out this trip to ${trip.destination}!`, url }); } catch {}
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

  const getTransportIcon = (type: string | null) => {
    const icons: Record<string, JSX.Element> = {
      car: <Car className="h-3 w-3" />,
      plane: <Plane className="h-3 w-3" />,
      bus: <Bus className="h-3 w-3" />,
      train: <Train className="h-3 w-3" />,
    };
    return icons[type || ""] || null;
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 safe-top border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-display font-bold">Discover Trips</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon"><Search className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon"><SlidersHorizontal className="h-5 w-5" /></Button>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No trips available yet</p>
            <Button onClick={() => navigate("/create-trip")} className="gap-2">
              <Plus className="h-4 w-4" /> Create First Trip
            </Button>
          </div>
        ) : (
          trips.map((trip, index) => (
            <article
              key={trip.id}
              className="bg-card rounded-3xl overflow-hidden shadow-card animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Author header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                    <AvatarImage src={profiles[trip.user_id]?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profiles[trip.user_id]?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{profiles[trip.user_id]?.full_name || "Traveler"}</p>
                    <p className="text-xs text-muted-foreground">{getTimeAgo(trip.created_at)}</p>
                  </div>
                </div>
                {user?.id === trip.user_id ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/create-trip/${trip.id}`)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Trip</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTrip(trip.id)} className="rounded-xl bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="rounded-full text-primary border-primary h-8">
                    Follow
                  </Button>
                )}
              </div>

              {/* Trip image */}
              <div className="relative" onClick={() => navigate(`/trip/${trip.id}`)}>
                <div className="aspect-[4/3] bg-muted">
                  {tripImages[trip.id] ? (
                    <img src={tripImages[trip.id]} alt={trip.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Badge className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground font-semibold">
                  ~${trip.cost} USD
                </Badge>
              </div>

              {/* Trip details */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
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
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">{trip.description}</p>

                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary font-medium">{trip.destination}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <Heart className="h-5 w-5" />
                      <span className="text-sm">{Math.floor(Math.random() * 100 + 10)}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm">{Math.floor(Math.random() * 20)}</span>
                    </button>
                    <button onClick={() => handleShare(trip)} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    className="rounded-full px-5"
                    disabled={trip.current_travelers >= trip.max_travelers}
                  >
                    {trip.current_travelers >= trip.max_travelers ? "Trip Full" : "Join Trip"}
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* FAB */}
      <Button
        size="lg"
        onClick={() => navigate("/create-trip")}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-glow z-20"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Feed;
