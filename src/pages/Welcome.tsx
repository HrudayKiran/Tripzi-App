import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plane, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import tripziLogo from "@/assets/tripzi-logo.png";

const Welcome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  const slides = [
    {
      icon: <Plane className="h-8 w-8" />,
      title: "Discover Adventures",
      description: "Find amazing trips curated by fellow travelers",
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Connect & Travel",
      description: "Join groups and make lifelong travel buddies",
    },
    {
      icon: <MapPin className="h-8 w-8" />,
      title: "Explore Together",
      description: "Share experiences and create memories",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col safe-top safe-bottom">
      {/* Hero Image Section */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-12">
        {/* Decorative elements */}
        <div className="absolute top-8 left-6 w-12 h-12 bg-card rounded-full shadow-lg flex items-center justify-center animate-bounce-gentle">
          <Plane className="h-6 w-6 text-primary" />
        </div>
        <div className="absolute top-20 right-8 w-16 h-16 border-2 border-dashed border-primary/30 rounded-full" />

        {/* Main card with image */}
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-xl animate-fade-up">
          <img
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=1000&fit=crop"
            alt="Mountain road"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-md">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Swiss Alps</span>
          </div>
          
          {/* Overlay travelers */}
          <div className="absolute bottom-4 right-4 w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-4 border-card">
            <img
              src="https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=200&h=200&fit=crop"
              alt="Travelers"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-6 pb-8 space-y-6 animate-slide-up">
        {/* Logo and branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-glow">
            <img src={tripziLogo} alt="Tripzi" className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground">Tripzi</h1>
          <p className="text-lg text-muted-foreground text-center">
            Explore the world, <span className="text-primary font-semibold underline decoration-2 underline-offset-4">not alone.</span>
          </p>
        </div>

        {/* Slide indicators */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "w-8 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Community indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-muted border-2 border-card overflow-hidden"
              >
                <img
                  src={`https://i.pravatar.cc/32?img=${i + 10}`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center border-2 border-card">
              <span className="text-xs font-semibold text-accent-foreground">1k+</span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground font-medium">JOIN THE JOURNEY</span>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => navigate("/auth")}
          className="w-full h-14 text-lg font-semibold rounded-2xl shadow-glow group"
        >
          Get Started
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
