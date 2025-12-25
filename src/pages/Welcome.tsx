import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import tripziLogo from "@/assets/tripzi-logo.png";

const ladakhImages = [
  {
    url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=1000&fit=crop",
    location: "Pangong Lake",
  },
  {
    url: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=800&h=1000&fit=crop",
    location: "Khardung La Pass",
  },
  {
    url: "https://images.unsplash.com/photo-1516496636080-14fb876e029d?w=800&h=1000&fit=crop",
    location: "Nubra Valley",
  },
  {
    url: "https://images.unsplash.com/photo-1600240644455-3edc55c375fe?w=800&h=1000&fit=crop",
    location: "Leh Palace",
  },
  {
    url: "https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=800&h=1000&fit=crop",
    location: "Magnetic Hill",
  },
];

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
    { title: "Discover Adventures", description: "Find amazing trips curated by fellow travelers" },
    { title: "Connect & Travel", description: "Join groups and make lifelong travel buddies" },
    { title: "Explore Together", description: "Share experiences and create memories" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % ladakhImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col safe-top safe-bottom">
      {/* Hero Image Section */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-12">
        {/* Main card with scrolling Ladakh images */}
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-xl animate-fade-up">
          {ladakhImages.map((image, index) => (
            <img
              key={index}
              src={image.url}
              alt={image.location}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          
          {/* Location badge */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-md z-10">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{ladakhImages[currentSlide].location}</span>
          </div>
          
          {/* Overlay travelers */}
          <div className="absolute bottom-4 right-4 w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-4 border-card z-10">
            <img
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop"
              alt="Bike riders"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Image indicators */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {ladakhImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/50"
                }`}
              />
            ))}
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
                index === Math.floor(currentSlide / 2) % slides.length
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

        {/* Next Button */}
        <Button
          onClick={() => navigate("/auth")}
          className="w-full h-14 text-lg font-semibold rounded-2xl shadow-glow"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
