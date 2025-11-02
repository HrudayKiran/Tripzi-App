import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MapPin, Plus, Calendar, Users, Edit } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import heroImage from "@/assets/hero-travel.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  full_name: string | null;
  avatar_url: string | null;
}
const Feed = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      fetchUserTrips();
    }
  }, [user]);
  const fetchUserTrips = async () => {
    if (!user) return;
    try {
      const {
        data: tripsData,
        error
      } = await supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      if (tripsData) {
        const {
          data: profileData
        } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).single();
        if (profileData) {
          setProfiles({
            [user.id]: {
              full_name: profileData.full_name,
              avatar_url: profileData.avatar_url
            }
          });
        }
        setTrips(tripsData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load your trips",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  return <div className="min-h-screen pb-24 bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-primary-foreground">My Trips</h1>
      </div>

      {/* Posts */}
      <div className="p-4 space-y-4">
        {loading ? <div className="text-center py-8 text-muted-foreground">Loading your trips...</div> : trips.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">You haven't posted any trips yet</p>
            <Button onClick={() => navigate("/create-trip")} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Trip
            </Button>
          </div> : trips.map((trip, index) => <Card key={trip.id} className="overflow-hidden shadow-lg animate-fade-up hover:shadow-xl transition-all" style={{
        animationDelay: `${index * 100}ms`
      }}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={profiles[trip.user_id]?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profiles[trip.user_id]?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{profiles[trip.user_id]?.full_name || "You"}</p>
                      <p className="text-sm text-muted-foreground">{getTimeAgo(trip.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/create-trip/${trip.id}`);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Badge variant="secondary">${trip.cost}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">{trip.destination}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 p-0">
                <div className="relative h-64 overflow-hidden cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                  <img src={heroImage} alt={trip.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="px-4 space-y-2 cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                  <h3 className="font-bold text-lg">{trip.title}</h3>
                  <p className="text-sm line-clamp-2">{trip.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(trip.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{trip.current_travelers}/{trip.max_travelers}</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t pt-4">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Heart className="h-4 w-4" />
                  <span>0</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>0</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  <span>0</span>
                </Button>
              </CardFooter>
            </Card>)}
      </div>

      {/* Floating Action Button */}
      {trips.length > 0 && (
        <Button
          size="lg"
          className="fixed bottom-20 right-4 rounded-full h-14 w-14 shadow-lg z-20"
          onClick={() => navigate("/create-trip")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>;
};
export default Feed;