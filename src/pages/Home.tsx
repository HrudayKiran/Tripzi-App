import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowUpDown, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/currency";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { TripPost } from "@/components/TripPost";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserSearchModal } from "@/components/UserSearchModal";

interface Trip {
  id: string;
  title: string;
  destination: string;
  description: string;
  cost: number;
  start_date: string;
  end_date: string;
  max_travelers: number;
  current_travelers: number;
  user_id: string;
  created_at: string;
  gender_preference: string | null;
  transport_type: string | null;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ maxCost: 100000, destination: "", minDays: 0, maxPersons: 20 });
  const [sortBy, setSortBy] = useState<string>("newest");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tripId: string | null }>({ open: false, tripId: null });
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [showUserSearch, setShowUserSearch] = useState(false);

  const filterCategories = ["All", "Recent", "Budget", "Popular"];
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    fetchTrips();
    fetchFollowing();
    
    const channel = supabase
      .channel("home-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => fetchTrips())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchFollowing = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    
    if (data) {
      setFollowingIds(new Set(data.map((f) => f.following_id)));
    }
  };

  const fetchTrips = async () => {
    try {
      let query = supabase
        .from("trips")
        .select("*")
        .eq("status", "open");
      
      // Exclude current user's trips - only show other users' trips
      if (user) {
        query = query.neq("user_id", user.id);
      }
      
      // Apply sorting based on filter
      if (activeFilter === "Recent" || sortBy === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (activeFilter === "Popular") {
        query = query.order("current_travelers", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data: tripsData } = await query;

      if (tripsData) {
        const userIds = [...new Set(tripsData.map((t) => t.user_id))];
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds);

          if (profilesData) {
            const map: Record<string, Profile> = {};
            profilesData.forEach((p) => { map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
            setProfiles(map);
          }
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
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { fetchTrips(); return; }
    
    // Sanitize search input: escape LIKE wildcards and limit length
    const sanitizedQuery = searchQuery
      .trim()
      .substring(0, 100) // Limit length
      .replace(/[%_\\]/g, '\\$&'); // Escape LIKE wildcards
    
    // Validate input contains only safe characters
    if (!/^[\w\s,.\-']+$/i.test(sanitizedQuery)) {
      setTrips([]);
      return;
    }
    
    const { data } = await supabase
      .from("trips")
      .select("*")
      .eq("status", "open")
      .or(`title.ilike.%${sanitizedQuery}%,destination.ilike.%${sanitizedQuery}%`)
      .order("created_at", { ascending: false });
    setTrips(data || []);
  };

  const handleDeleteTrip = async () => {
    if (!deleteDialog.tripId) return;
    
    try {
      await supabase.from("trips").delete().eq("id", deleteDialog.tripId);
      setTrips((prev) => prev.filter((t) => t.id !== deleteDialog.tripId));
    } catch (error) {
      console.error("Error deleting trip:", error);
    } finally {
      setDeleteDialog({ open: false, tripId: null });
    }
  };

  const openDeleteDialog = (tripId: string) => {
    setDeleteDialog({ open: true, tripId });
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display font-bold">Tripzi</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowUserSearch(true)}
              className="h-10 w-10"
            >
              <Users className="h-5 w-5" />
            </Button>
            <NotificationsPanel />
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trips, people, or places"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 h-12 rounded-xl bg-muted/50"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0">
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Filter & Sort Trips</SheetTitle></SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Sort Options */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2"><ArrowUpDown className="h-4 w-4" /> Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="days_short">Duration: Shortest First</SelectItem>
                      <SelectItem value="days_long">Duration: Longest First</SelectItem>
                      <SelectItem value="travelers">Most Travelers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Max Cost: {formatINR(filters.maxCost)}</Label>
                  <Slider value={[filters.maxCost]} onValueChange={(v) => setFilters({ ...filters, maxCost: v[0] })} max={500000} step={1000} />
                </div>

                <div className="space-y-3">
                  <Label>Max Travelers: {filters.maxPersons}</Label>
                  <Slider value={[filters.maxPersons]} onValueChange={(v) => setFilters({ ...filters, maxPersons: v[0] })} min={1} max={50} step={1} />
                </div>

                <div className="space-y-3">
                  <Label>Minimum Days: {filters.minDays}</Label>
                  <Slider value={[filters.minDays]} onValueChange={(v) => setFilters({ ...filters, minDays: v[0] })} max={30} step={1} />
                </div>

                <div className="space-y-3">
                  <Label>Destination</Label>
                  <Input placeholder="e.g., Paris" value={filters.destination} onChange={(e) => setFilters({ ...filters, destination: e.target.value })} />
                </div>
                <Button onClick={fetchTrips} className="w-full">Apply Filters</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Filter chips */}
        <ScrollArea className="mt-3 -mx-4 px-4">
          <div className="flex gap-2">
            {filterCategories.map((cat) => (
              <Button
                key={cat}
                variant={activeFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(cat)}
                className="rounded-full shrink-0"
              >
                {cat}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Trip Posts Feed */}
      <div className="px-4 space-y-4 mt-4">
        {loading ? (
          <div className="text-muted-foreground py-12 text-center">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No trips available yet</p>
            <Button onClick={() => navigate("/create-trip")}>Create First Trip</Button>
          </div>
        ) : (
          trips.map((trip, index) => (
            <TripPost
              key={trip.id}
              trip={trip}
              profile={profiles[trip.user_id] || null}
              imageUrl={tripImages[trip.id] || null}
              onDelete={openDeleteDialog}
              index={index}
              isFollowing={followingIds.has(trip.user_id)}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, tripId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trip? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrip} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Search Modal */}
      <UserSearchModal open={showUserSearch} onOpenChange={setShowUserSearch} />
    </div>
  );
};

export default Home;
