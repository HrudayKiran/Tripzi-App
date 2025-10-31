import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, MapPin, TrendingUp, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import tripziLogo from "@/assets/tripzi-logo.png";
import heroImage from "@/assets/hero-travel.jpg";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsPanel } from "@/components/NotificationsPanel";

interface Trip {
  id: string;
  title: string;
  destination: string;
  cost: number;
  start_date: string;
  end_date: string;
  max_travelers: number;
  current_travelers: number;
  user_id: string;
}

interface Profile {
  full_name: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    maxCost: 10000,
    destination: "",
    minDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      if (tripsData) {
        const userIds = [...new Set(tripsData.map(t => t.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profilesData) {
          const profilesMap: Record<string, Profile> = {};
          profilesData.forEach(p => {
            profilesMap[p.id] = { full_name: p.full_name };
          });
          setProfiles(profilesMap);
        }

        setTrips(tripsData);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchTrips();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .or(`title.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%`)
        .order("created_at", { ascending: false});

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error("Error searching trips:", error);
    }
  };

  const applyFilters = async () => {
    try {
      let query = supabase
        .from("trips")
        .select("*")
        .eq("status", "open");

      if (filters.maxCost < 10000) {
        query = query.lte("cost", filters.maxCost);
      }

      if (filters.destination) {
        query = query.ilike("destination", `%${filters.destination}%`);
      }

      const { data } = await query.order("created_at", { ascending: false });
      
      let filtered = data || [];

      if (filters.minDays > 0) {
        filtered = filtered.filter(trip => {
          const days = Math.ceil(
            (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 3600 * 24)
          );
          return days >= filters.minDays;
        });
      }

      setTrips(filtered);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const getDaysCount = (startDate: string, endDate: string) => {
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)
    );
    return days;
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <img src={tripziLogo} alt="Tripzi" className="w-10 h-10" />
          <NotificationsPanel />
        </div>
        
        {/* Search Bar */}
        <div className="flex gap-2 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search destinations, trips..." 
              className="pl-10 bg-background/95"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="secondary">
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Trips</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Max Cost: ${filters.maxCost}</Label>
                  <Slider
                    value={[filters.maxCost]}
                    onValueChange={(value) => setFilters({ ...filters, maxCost: value[0] })}
                    max={10000}
                    step={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input
                    placeholder="e.g., Paris"
                    value={filters.destination}
                    onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Days: {filters.minDays || "Any"}</Label>
                  <Slider
                    value={[filters.minDays]}
                    onValueChange={(value) => setFilters({ ...filters, minDays: value[0] })}
                    max={30}
                    step={1}
                  />
                </div>
                <Button onClick={applyFilters} className="w-full">
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative h-48 overflow-hidden">
        <img src={heroImage} alt="Travel" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-4">
          <div className="animate-fade-up">
            <h2 className="text-2xl font-bold text-primary-foreground">Discover Your Next Adventure</h2>
            <p className="text-sm text-primary-foreground/90">Connect with travelers worldwide</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Available Trips */}
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Available Trips</h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading trips...</div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No trips available</div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip, index) => (
                <Card 
                  key={trip.id} 
                  className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => navigate(`/trip/${trip.id}`)}
                >
                  <div className="relative h-40">
                    <img src={heroImage} alt={trip.title} className="w-full h-full object-cover" />
                    <Badge className="absolute top-2 right-2 bg-secondary">
                      ${trip.cost}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{trip.title}</CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="text-xs">{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-xs">{trip.current_travelers} / {trip.max_travelers} travelers</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getDaysCount(trip.start_date, trip.end_date)} days • by {profiles[trip.user_id]?.full_name || "Anonymous"}
                      </p>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;
