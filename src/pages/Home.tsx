import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, MapPin, TrendingUp, Users, Heart, MessageCircle, Share2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import tripziLogo from "@/assets/tripzi-logo.png";
import heroImage from "@/assets/hero-travel.jpg";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
  avatar_url: string | null;
  id: string;
}

interface Engagement {
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isShared: boolean;
  isFollowing: boolean;
}

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [engagement, setEngagement] = useState<Record<string, Engagement>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    maxCost: 10000,
    destination: "",
    minDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTrips();
    }
  }, [user]);

  const fetchTrips = async () => {
    if (!user) return;
    
    try {
      // Fetch trips excluding current user's posts
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      if (tripsData) {
        const userIds = [...new Set(tripsData.map(t => t.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesData) {
          const profilesMap: Record<string, Profile> = {};
          profilesData.forEach(p => {
            profilesMap[p.id] = { 
              full_name: p.full_name, 
              avatar_url: p.avatar_url,
              id: p.id
            };
          });
          setProfiles(profilesMap);
        }

        setTrips(tripsData);
        
        // Fetch engagement data for all trips
        await fetchEngagementData(tripsData.map(t => t.id));
        
        // Fetch follow status
        await fetchFollowStatus(userIds);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
      toast({
        title: "Error",
        description: "Failed to load trips",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEngagementData = async (tripIds: string[]) => {
    if (!user || tripIds.length === 0) return;

    try {
      // Fetch likes
      const { data: likesData } = await supabase
        .from("likes")
        .select("trip_id, user_id")
        .in("trip_id", tripIds);

      // Fetch comments count
      const { data: commentsData } = await supabase
        .from("comments")
        .select("trip_id")
        .in("trip_id", tripIds);

      // Fetch shares
      const { data: sharesData } = await supabase
        .from("shares")
        .select("trip_id, user_id")
        .in("trip_id", tripIds);

      const engagementMap: Record<string, Engagement> = {};
      
      tripIds.forEach(tripId => {
        const likes = likesData?.filter(l => l.trip_id === tripId) || [];
        const comments = commentsData?.filter(c => c.trip_id === tripId) || [];
        const shares = sharesData?.filter(s => s.trip_id === tripId) || [];
        
        engagementMap[tripId] = {
          likes: likes.length,
          comments: comments.length,
          shares: shares.length,
          isLiked: likes.some(l => l.user_id === user.id),
          isShared: shares.some(s => s.user_id === user.id),
          isFollowing: false, // Will be updated by fetchFollowStatus
        };
      });

      setEngagement(prev => ({ ...prev, ...engagementMap }));
    } catch (error) {
      console.error("Error fetching engagement:", error);
    }
  };

  const fetchFollowStatus = async (userIds: string[]) => {
    if (!user || userIds.length === 0) return;

    try {
      const { data: followsData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", userIds);

      const followingIds = new Set(followsData?.map(f => f.following_id) || []);

      // Update engagement map with follow status for each trip
      setEngagement(prev => {
        const updated = { ...prev };
        trips.forEach(trip => {
          if (updated[trip.id]) {
            updated[trip.id] = {
              ...updated[trip.id],
              isFollowing: followingIds.has(trip.user_id),
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error("Error fetching follow status:", error);
    }
  };

  const handleSearch = async () => {
    if (!user) return;
    
    if (!searchQuery.trim()) {
      fetchTrips();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .neq("user_id", user.id)
        .or(`title.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%`)
        .order("created_at", { ascending: false});

      if (error) throw error;
      setTrips(data || []);
      if (data) {
        await fetchEngagementData(data.map(t => t.id));
        const userIds = [...new Set(data.map(t => t.user_id))];
        await fetchFollowStatus(userIds);
      }
    } catch (error) {
      console.error("Error searching trips:", error);
    }
  };

  const applyFilters = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from("trips")
        .select("*")
        .eq("status", "open")
        .neq("user_id", user.id);

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
      if (filtered.length > 0) {
        await fetchEngagementData(filtered.map(t => t.id));
        const userIds = [...new Set(filtered.map(t => t.user_id))];
        await fetchFollowStatus(userIds);
      }
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const handleLike = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isLiked = engagement[tripId]?.isLiked;
    
    try {
      if (isLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("trip_id", tripId)
          .eq("user_id", user.id);
        
        if (error) throw error;
        
        setEngagement(prev => ({
          ...prev,
          [tripId]: {
            ...prev[tripId],
            likes: (prev[tripId]?.likes || 1) - 1,
            isLiked: false,
          },
        }));
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ trip_id: tripId, user_id: user.id });
        
        if (error) throw error;
        
        setEngagement(prev => ({
          ...prev,
          [tripId]: {
            ...prev[tripId],
            likes: (prev[tripId]?.likes || 0) + 1,
            isLiked: true,
          },
        }));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isShared = engagement[tripId]?.isShared;
    
    try {
      if (isShared) {
        const { error } = await supabase
          .from("shares")
          .delete()
          .eq("trip_id", tripId)
          .eq("user_id", user.id);
        
        if (error) throw error;
        
        setEngagement(prev => ({
          ...prev,
          [tripId]: {
            ...prev[tripId],
            shares: (prev[tripId]?.shares || 1) - 1,
            isShared: false,
          },
        }));
      } else {
        const { error } = await supabase
          .from("shares")
          .insert({ trip_id: tripId, user_id: user.id });
        
        if (error) throw error;
        
        setEngagement(prev => ({
          ...prev,
          [tripId]: {
            ...prev[tripId],
            shares: (prev[tripId]?.shares || 0) + 1,
            isShared: true,
          },
        }));
      }
    } catch (error) {
      console.error("Error toggling share:", error);
      toast({
        title: "Error",
        description: "Failed to update share",
        variant: "destructive",
      });
    }
  };

  const handleFollow = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || userId === user.id) return;

    // Check if user is following this specific user
    const trip = trips.find(t => t.user_id === userId);
    const isFollowing = trip ? engagement[trip.id]?.isFollowing : false;
    
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        
        if (error) throw error;
        
        // Update engagement for all trips by this user
        setEngagement(prev => {
          const updated = { ...prev };
          trips.forEach(trip => {
            if (trip.user_id === userId && updated[trip.id]) {
              updated[trip.id] = { ...updated[trip.id], isFollowing: false };
            }
          });
          return updated;
        });
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: userId });
        
        if (error) throw error;
        
        // Update engagement for all trips by this user
        setEngagement(prev => {
          const updated = { ...prev };
          trips.forEach(trip => {
            if (trip.user_id === userId && updated[trip.id]) {
              updated[trip.id] = { ...updated[trip.id], isFollowing: true };
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast({
        title: "Error",
        description: "Failed to update follow",
        variant: "destructive",
      });
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
                  className="overflow-hidden hover:shadow-lg transition-all duration-300 animate-fade-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="relative h-40 cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                    <img src={heroImage} alt={trip.title} className="w-full h-full object-cover" />
                    <Badge className="absolute top-2 right-2 bg-secondary">
                      ${trip.cost}
                    </Badge>
                  </div>
                  <CardHeader className="cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profiles[trip.user_id]?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {profiles[trip.user_id]?.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{trip.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {profiles[trip.user_id]?.full_name || "Anonymous"}
                          </p>
                        </div>
                      </div>
                      {trip.user_id !== user?.id && (
                        <Button
                          variant={engagement[trip.id]?.isFollowing ? "secondary" : "outline"}
                          size="sm"
                          onClick={(e) => handleFollow(trip.user_id, e)}
                          className="ml-2"
                        >
                          <UserPlus className={`h-4 w-4 ${engagement[trip.id]?.isFollowing ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                    </div>
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
                        {getDaysCount(trip.start_date, trip.end_date)} days
                      </p>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex items-center justify-between border-t pt-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={(e) => handleLike(trip.id, e)}
                    >
                      <Heart className={`h-4 w-4 ${engagement[trip.id]?.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                      <span>{engagement[trip.id]?.likes || 0}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/trip/${trip.id}`);
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{engagement[trip.id]?.comments || 0}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={(e) => handleShare(trip.id, e)}
                    >
                      <Share2 className={`h-4 w-4 ${engagement[trip.id]?.isShared ? 'text-primary' : ''}`} />
                      <span>{engagement[trip.id]?.shares || 0}</span>
                    </Button>
                  </CardFooter>
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
