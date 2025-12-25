import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Users, MessageCircle, UserPlus, UserMinus, Grid3X3, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";

interface UserProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  kyc_status: string | null;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  cost: number;
  start_date: string;
  end_date: string;
  max_travelers: number;
  current_travelers: number;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchUserTrips();
      fetchFollowStatus();
      fetchFollowCounts();
    }
  }, [userId, user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, kyc_status")
        .eq("id", userId)
        .single();
      
      if (data) setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTrips = async () => {
    const { data: tripsData } = await supabase
      .from("trips")
      .select("id, title, destination, cost, start_date, end_date, max_travelers, current_travelers")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (tripsData) {
      setTrips(tripsData);
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
    }
  };

  const fetchFollowStatus = async () => {
    if (!user || isOwnProfile) return;
    
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();
    
    setIsFollowing(!!data);
  };

  const fetchFollowCounts = async () => {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact" }).eq("following_id", userId),
      supabase.from("follows").select("id", { count: "exact" }).eq("follower_id", userId),
    ]);
    
    setFollowersCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
  };

  const handleFollow = async () => {
    if (!user) {
      toast({ title: "Please log in", description: "You need to be logged in to follow users" });
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        setIsFollowing(false);
        setFollowersCount((prev) => prev - 1);
        toast({ title: "Unfollowed", description: `You unfollowed ${profile?.full_name || "this user"}` });
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: userId });
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        toast({ title: "Following", description: `You are now following ${profile?.full_name || "this user"}` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update follow status", variant: "destructive" });
    }
  };

  const handleMessage = () => {
    navigate(`/chat/${userId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground mb-4">User not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{profile.full_name || "User"}</h1>
        </div>
      </div>

      {/* Profile Header */}
      <div className="p-6 animate-fade-in">
        <div className="flex items-start gap-6">
          <Avatar className="w-24 h-24 ring-4 ring-primary/20">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              {profile.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{profile.full_name || "User"}</h2>
              {profile.kyc_status === "verified" && (
                <Badge className="bg-success text-success-foreground text-xs">Verified</Badge>
              )}
            </div>
            
            {profile.bio && (
              <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="font-bold">{trips.length}</p>
                <p className="text-muted-foreground">Trips</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{followersCount}</p>
                <p className="text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{followingCount}</p>
                <p className="text-muted-foreground">Following</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleFollow}
              className={`flex-1 rounded-xl ${isFollowing ? "bg-muted text-foreground hover:bg-muted/80" : ""}`}
              variant={isFollowing ? "outline" : "default"}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" /> Follow
                </>
              )}
            </Button>
            <Button onClick={handleMessage} variant="outline" className="flex-1 rounded-xl">
              <MessageCircle className="h-4 w-4 mr-2" /> Message
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trips" className="px-4">
        <TabsList className="w-full bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="trips" className="flex-1 rounded-lg gap-2">
            <Grid3X3 className="h-4 w-4" /> Trips
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex-1 rounded-lg gap-2">
            <Bookmark className="h-4 w-4" /> Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          {trips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No trips posted yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {trips.map((trip, index) => (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trip/${trip.id}`)}
                  className="aspect-square rounded-2xl overflow-hidden bg-card shadow-card cursor-pointer hover:scale-[1.02] transition-transform animate-scale-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {tripImages[trip.id] ? (
                    <div className="relative h-full">
                      <img
                        src={tripImages[trip.id]}
                        alt={trip.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white text-sm font-semibold line-clamp-1">{trip.destination}</p>
                        <p className="text-white/80 text-xs">{formatINR(trip.cost)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-muted p-3">
                      <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-center line-clamp-2">{trip.destination}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(trip.cost)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          <div className="text-center py-12 text-muted-foreground">
            <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No saved trips yet</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfile;
