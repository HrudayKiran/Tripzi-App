import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, MapPin, TrendingUp, Users, Calendar, MessageSquare, Plus, ChevronRight, Car, Plane, Bus, Train, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  gender_preference: string | null;
  transport_type: string | null;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ maxCost: 10000, destination: "", minDays: 0 });

  const filterCategories = ["All", "Dates", "Budget", "Activities"];
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    fetchTrips();
    
    const channel = supabase
      .channel("home-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => fetchTrips())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTrips = async () => {
    try {
      const { data: tripsData } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

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

  const getDaysCount = (start: string, end: string) =>
    Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 3600 * 24));

  const getTransportIcon = (type: string | null) => {
    const icons: Record<string, JSX.Element> = {
      car: <Car className="h-3 w-3" />,
      plane: <Plane className="h-3 w-3" />,
      bus: <Bus className="h-3 w-3" />,
      train: <Train className="h-3 w-3" />,
    };
    return icons[type || ""] || null;
  };

  const trendingTrips = trips.slice(0, 5);
  const quickMatches = trips.slice(0, 3);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display font-bold">Tripzi</h1>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </Button>
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
              <SheetHeader><SheetTitle>Filter Trips</SheetTitle></SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-3">
                  <Label>Max Cost: ${filters.maxCost}</Label>
                  <Slider value={[filters.maxCost]} onValueChange={(v) => setFilters({ ...filters, maxCost: v[0] })} max={10000} step={100} />
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

      <div className="px-4 space-y-6 mt-4">
        {/* Map preview section */}
        <section className="animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Travelers near Bali</h2>
            <button className="text-sm text-primary font-medium">View Map</button>
          </div>
          <div className="relative h-40 rounded-2xl overflow-hidden bg-muted">
            <img
              src="https://api.mapbox.com/styles/v1/mapbox/light-v11/static/-115.4,36.2,3,0/400x200?access_token=pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbHNxYnBkcXkwMGZrMmpxdDk5ejVpZWVkIn0.gkH9WxlM35ufDqCxfXLauw"
              alt="Map"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <MapPin className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">12 Travelers nearby</span>
            </div>
          </div>
        </section>

        {/* Trending Trips */}
        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trending Trips</h2>
            </div>
            <button onClick={() => navigate("/trips")} className="text-sm text-primary font-medium flex items-center">
              See All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          
          <ScrollArea className="-mx-4 px-4">
            <div className="flex gap-4 pb-2">
              {loading ? (
                <div className="text-muted-foreground py-8 text-center w-full">Loading...</div>
              ) : trendingTrips.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center w-full">No trips available</div>
              ) : (
                trendingTrips.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    className="w-64 shrink-0 bg-card rounded-2xl overflow-hidden shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="relative h-36">
                      {tripImages[trip.id] ? (
                        <img src={tripImages[trip.id]} alt={trip.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-card/90 text-foreground backdrop-blur-sm">
                        <Calendar className="h-3 w-3 mr-1" />
                        {getDaysCount(trip.start_date, trip.end_date)} Days
                      </Badge>
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold line-clamp-1">{trip.title}</h3>
                        <span className="text-primary font-bold">${trip.cost}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{trip.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {[1, 2].map((i) => (
                            <Avatar key={i} className="w-6 h-6 border-2 border-card">
                              <AvatarImage src={profiles[trip.user_id]?.avatar_url || ""} />
                              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                {profiles[trip.user_id]?.full_name?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                            <span className="text-[10px] font-medium">+{trip.current_travelers}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-full">
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>

        {/* Quick Matches */}
        <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-lg font-semibold mb-3">Quick Matches</h2>
          <div className="space-y-3">
            {quickMatches.map((trip) => (
              <div
                key={trip.id}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="flex items-center gap-3 p-3 bg-card rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <Avatar className="w-14 h-14">
                  <AvatarImage src={profiles[trip.user_id]?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {profiles[trip.user_id]?.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{profiles[trip.user_id]?.full_name || "Traveler"}</h3>
                    <Badge variant="secondary" className="text-xs bg-success/10 text-success shrink-0">
                      {Math.floor(Math.random() * 20 + 80)}% Match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    Heading to {trip.destination} in {new Date(trip.start_date).toLocaleDateString("en-US", { month: "short" })}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {trip.transport_type && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {getTransportIcon(trip.transport_type)} {trip.transport_type}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-success rounded-full" />
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
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

export default Home;
