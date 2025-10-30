import { Search, SlidersHorizontal, Bell, MapPin, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import tripziLogo from "@/assets/tripzi-logo.png";
import heroImage from "@/assets/hero-travel.jpg";

const Home = () => {
  const trendingTrips = [
    { id: 1, title: "Bali Paradise", location: "Bali, Indonesia", price: "$1,200", image: heroImage },
    { id: 2, title: "Swiss Alps Adventure", location: "Switzerland", price: "$2,500", image: heroImage },
    { id: 3, title: "Tokyo Nights", location: "Tokyo, Japan", price: "$1,800", image: heroImage },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <img src={tripziLogo} alt="Tripzi" className="w-10 h-10" />
          <Button variant="ghost" size="icon" className="text-primary-foreground">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Search Bar */}
        <div className="flex gap-2 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search destinations, trips, users..." 
              className="pl-10 bg-background/95"
            />
          </div>
          <Button size="icon" variant="secondary">
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative h-48 overflow-hidden">
        <img src={heroImage} alt="Travel" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-4">
          <div className="animate-fade-up">
            <h2 className="text-2xl font-bold text-primary-foreground">Discover Your Next Adventure</h2>
            <p className="text-sm text-primary-foreground/90">Explore trending destinations worldwide</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Trending Trips */}
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Trending Trips</h3>
          </div>
          <div className="space-y-4">
            {trendingTrips.map((trip, index) => (
              <Card 
                key={trip.id} 
                className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative h-40">
                  <img src={trip.image} alt={trip.title} className="w-full h-full object-cover" />
                  <Badge className="absolute top-2 right-2 bg-secondary">
                    {trip.price}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{trip.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {trip.location}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4 animate-fade-up">
          <Card className="p-4 text-center cursor-pointer hover:bg-accent/10 transition-colors">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="font-medium">Plan Trip</p>
          </Card>
          <Card className="p-4 text-center cursor-pointer hover:bg-accent/10 transition-colors">
            <div className="text-3xl mb-2">✈️</div>
            <p className="font-medium">Find Flights</p>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Home;
