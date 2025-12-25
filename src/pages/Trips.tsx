import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImage from "@/assets/hero-travel.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Booking {
  id: string;
  status: string;
  trip_id: string;
  trips: {
    id: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    max_travelers: number;
    current_travelers: number;
    status: string;
  };
}

const Trips = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          status,
          trip_id,
          trips (
            id,
            title,
            destination,
            start_date,
            end_date,
            max_travelers,
            current_travelers,
            status
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-primary";
      case "pending": return "bg-accent";
      case "cancelled": return "bg-muted";
      default: return "bg-muted";
    }
  };

  const filterBookings = (filter: 'upcoming' | 'active' | 'completed') => {
    const now = new Date();
    return bookings.filter(booking => {
      const startDate = new Date(booking.trips.start_date);
      const endDate = new Date(booking.trips.end_date);
      
      if (filter === 'upcoming') {
        return startDate > now && booking.status !== 'cancelled';
      } else if (filter === 'active') {
        return startDate <= now && endDate >= now && booking.status !== 'cancelled';
      } else {
        return endDate < now || booking.status === 'cancelled';
      }
    });
  };

  const TripCard = ({ booking }: { booking: Booking }) => {
    const trip = booking.trips;
    return (
      <Card 
        className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up"
        onClick={() => navigate(`/trip/${trip.id}`)}
      >
        <div className="relative h-32">
          <img src={heroImage} alt={trip.title} className="w-full h-full object-cover" />
          <Badge className={`absolute top-2 right-2 ${getStatusColor(booking.status)}`}>
            {booking.status}
          </Badge>
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{trip.title}</CardTitle>
          <CardDescription className="space-y-2">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{trip.destination}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">
                {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">{trip.current_travelers} / {trip.max_travelers} travelers</span>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  };

  const upcomingBookings = filterBookings('upcoming');
  const activeBookings = filterBookings('active');
  const completedBookings = filterBookings('completed');

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary-foreground">My Trips</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading your trips...</div>
        ) : (
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No upcoming trips</div>
              ) : (
                upcomingBookings.map((booking, index) => (
                  <div key={booking.id} style={{ animationDelay: `${index * 100}ms` }}>
                    <TripCard booking={booking} />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-4 mt-4">
              {activeBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No active trips</div>
              ) : (
                activeBookings.map((booking, index) => (
                  <div key={booking.id} style={{ animationDelay: `${index * 100}ms` }}>
                    <TripCard booking={booking} />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4 mt-4">
              {completedBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No completed trips</div>
              ) : (
                completedBookings.map((booking, index) => (
                  <div key={booking.id} style={{ animationDelay: `${index * 100}ms` }}>
                    <TripCard booking={booking} />
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Trips;
