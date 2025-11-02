import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, DollarSign, Users, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import heroImage from "@/assets/hero-travel.jpg";

interface Trip {
  id: string;
  title: string;
  description: string;
  destination: string;
  location_url: string | null;
  cost: number;
  start_date: string;
  end_date: string;
  max_travelers: number;
  current_travelers: number;
  essentials: string[];
  status: string;
  user_id: string;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [hasBooked, setHasBooked] = useState(false);

  useEffect(() => {
    fetchTripDetails();
    if (user) checkBookingStatus();
  }, [id, user]);

  const fetchTripDetails = async () => {
    try {
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .single();

      if (tripError) throw tripError;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", tripData.user_id)
        .single();

      const { data: imagesData } = await supabase
        .from("trip_images")
        .select("image_url")
        .eq("trip_id", id);

      setTrip(tripData);
      setProfile(profileData);
      setImages(imagesData?.map(img => img.image_url) || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load trip details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBookingStatus = async () => {
    if (!user || !id) return;
    
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    setHasBooked(!!data);
  };

  const handleBookTrip = async () => {
    if (!user || !trip) return;

    setBooking(true);
    try {
      // Use atomic RPC function to prevent race conditions
      const { data, error } = await supabase.rpc('book_trip', {
        p_trip_id: trip.id,
        p_user_id: user.id
      });

      if (error) throw error;

      // Check if the RPC returned an error (data is a JSONB object)
      const result = data as { error?: string; success?: boolean };
      if (result?.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Success!",
        description: "Trip booked successfully!",
      });
      setHasBooked(true);
      fetchTripDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to book trip",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const handleChat = () => {
    navigate(`/chat/${trip?.user_id}`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!trip) {
    return <div className="min-h-screen flex items-center justify-center">Trip not found</div>;
  }

  const isOwnTrip = user?.id === trip.user_id;
  const isFull = trip.current_travelers >= trip.max_travelers;

  return (
    <div className="min-h-screen pb-24 bg-muted/30">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary-foreground">Trip Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative h-64 rounded-lg overflow-hidden">
          <img src={images.length > 0 ? images[0] : heroImage} alt={trip.title} className="w-full h-full object-cover" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{trip.title}</CardTitle>
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">{trip.destination}</span>
                </div>
              </div>
              <Badge className="bg-primary">${trip.cost}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile?.full_name || "Anonymous"}</p>
                <p className="text-sm text-muted-foreground">Trip Organizer</p>
              </div>
            </div>

            <Separator />

            <p className="text-sm">{trip.description}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Start</p>
                  <p className="text-muted-foreground">{new Date(trip.start_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">End</p>
                  <p className="text-muted-foreground">{new Date(trip.end_date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{trip.current_travelers} / {trip.max_travelers} travelers</span>
            </div>

            {trip.essentials && trip.essentials.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="font-semibold mb-2">Essentials</p>
                  <div className="flex flex-wrap gap-2">
                    {trip.essentials.map((item, index) => (
                      <Badge key={index} variant="secondary">{item}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {trip.location_url && (
              <Button variant="outline" className="w-full" asChild>
                <a href={trip.location_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Map
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {!isOwnTrip && (
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={handleBookTrip} 
              disabled={booking || hasBooked || isFull}
            >
              {hasBooked ? "Already Booked" : isFull ? "Trip Full" : booking ? "Booking..." : "Book This Trip"}
            </Button>
            <Button variant="outline" size="icon" onClick={handleChat}>
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripDetails;
