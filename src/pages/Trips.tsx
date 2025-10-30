import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImage from "@/assets/hero-travel.jpg";

const Trips = () => {
  const trips = {
    upcoming: [
      {
        id: 1,
        title: "Iceland Northern Lights",
        destination: "Reykjavik, Iceland",
        dates: "Dec 15-22, 2024",
        companions: 3,
        status: "confirmed",
        image: heroImage,
      },
      {
        id: 2,
        title: "New Year in Dubai",
        destination: "Dubai, UAE",
        dates: "Dec 28-Jan 5, 2025",
        companions: 2,
        status: "planning",
        image: heroImage,
      },
    ],
    active: [
      {
        id: 3,
        title: "Paris Weekend",
        destination: "Paris, France",
        dates: "Nov 20-24, 2024",
        companions: 1,
        status: "in-progress",
        image: heroImage,
      },
    ],
    completed: [
      {
        id: 4,
        title: "Bali Beach Holiday",
        destination: "Bali, Indonesia",
        dates: "Oct 1-10, 2024",
        companions: 4,
        status: "completed",
        image: heroImage,
      },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-primary";
      case "planning": return "bg-accent";
      case "in-progress": return "bg-secondary";
      case "completed": return "bg-muted";
      default: return "bg-muted";
    }
  };

  const TripCard = ({ trip }: { trip: any }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up">
      <div className="relative h-32">
        <img src={trip.image} alt={trip.title} className="w-full h-full object-cover" />
        <Badge className={`absolute top-2 right-2 ${getStatusColor(trip.status)}`}>
          {trip.status.replace('-', ' ')}
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
            <span className="text-xs">{trip.dates}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="text-xs">{trip.companions} companions</span>
          </div>
        </CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-primary-foreground">My Trips</h1>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 mt-4">
            {trips.upcoming.map((trip, index) => (
              <div key={trip.id} style={{ animationDelay: `${index * 100}ms` }}>
                <TripCard trip={trip} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="active" className="space-y-4 mt-4">
            {trips.active.map((trip, index) => (
              <div key={trip.id} style={{ animationDelay: `${index * 100}ms` }}>
                <TripCard trip={trip} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {trips.completed.map((trip, index) => (
              <div key={trip.id} style={{ animationDelay: `${index * 100}ms` }}>
                <TripCard trip={trip} />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Trips;
