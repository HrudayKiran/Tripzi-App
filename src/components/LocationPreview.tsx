import { useState, useEffect } from "react";
import { MapPin, Send, X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocationPreviewProps {
  open: boolean;
  onClose: () => void;
  onSend: (latitude: number, longitude: number) => void;
}

export const LocationPreview = ({ open, onClose, onSend }: LocationPreviewProps) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);

      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser");
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLoading(false);
        },
        (err) => {
          setError("Failed to get your location. Please enable location services.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [open]);

  const handleSend = () => {
    if (location) {
      onSend(location.lat, location.lng);
      onClose();
    }
  };

  const openInMaps = () => {
    if (location) {
      window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Share Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Navigation className="h-8 w-8 text-primary animate-pulse mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Getting your location...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-48 bg-destructive/10 rounded-lg flex items-center justify-center">
              <div className="text-center p-4">
                <MapPin className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          ) : location ? (
            <div className="space-y-3">
              {/* Map Preview using OpenStreetMap (free) */}
              <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01},${location.lat - 0.01},${location.lng + 0.01},${location.lat + 0.01}&layer=mapnik&marker=${location.lat},${location.lng}`}
                  className="w-full h-full border-0"
                  title="Location preview"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full h-8 px-3 text-xs"
                    onClick={openInMaps}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Open in Maps
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-red-500" />
                <span>
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!location || loading}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
