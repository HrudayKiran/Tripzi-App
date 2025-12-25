import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { StoriesBar } from "@/components/StoriesBar";
import { TripPost } from "@/components/TripPost";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchAllTrips();

    const channel = supabase
      .channel("feed-all-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => fetchAllTrips())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          profilesData.forEach((p) => {
            map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          });
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

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-2 safe-top border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Tripzi
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Stories Bar */}
        <StoriesBar />
      </div>

      {/* Feed */}
      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Search className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium mb-2">No trips available yet</p>
            <p className="text-sm mb-6">Be the first to create a trip!</p>
            <Button onClick={() => navigate("/create-trip")} className="rounded-full px-6">
              Create Trip
            </Button>
          </div>
        ) : (
          trips.map((trip, index) => (
            <TripPost
              key={trip.id}
              trip={trip}
              profile={profiles[trip.user_id]}
              imageUrl={tripImages[trip.id] || null}
              onDelete={openDeleteDialog}
              index={index}
            />
          ))
        )}
      </div>

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
