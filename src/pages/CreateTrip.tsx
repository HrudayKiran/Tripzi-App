import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, DollarSign, Users, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CreateTrip = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    destination: "",
    location_url: "",
    cost: "",
    start_date: "",
    end_date: "",
    max_travelers: "1",
    essentials: "",
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map(file => URL.createObjectURL(file));
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          destination: formData.destination,
          location_url: formData.location_url || null,
          cost: parseFloat(formData.cost),
          start_date: formData.start_date,
          end_date: formData.end_date,
          max_travelers: parseInt(formData.max_travelers),
          essentials: formData.essentials.split(",").map(e => e.trim()).filter(Boolean),
        })
        .select()
        .single();

      if (tripError) throw tripError;

      if (images.length > 0 && trip) {
        const imageInserts = images.map(image => ({
          trip_id: trip.id,
          image_url: image,
        }));
        
        const { error: imagesError } = await supabase
          .from("trip_images")
          .insert(imageInserts);

        if (imagesError) throw imagesError;
      }

      toast({
        title: "Success!",
        description: "Your trip has been posted successfully.",
      });
      navigate("/feed");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-muted/30">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary-foreground">Create Trip</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Trip Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Trip Title</Label>
              <Input
                id="title"
                placeholder="e.g., Weekend in Paris"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell others about your trip plans..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="destination">Destination</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="destination"
                  placeholder="e.g., Paris, France"
                  className="pl-10"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location_url">Location URL (Optional)</Label>
              <Input
                id="location_url"
                placeholder="Google Maps link"
                value={formData.location_url}
                onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start_date"
                    type="date"
                    className="pl-10"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="end_date">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end_date"
                    type="date"
                    className="pl-10"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Estimated Cost ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cost"
                    type="number"
                    placeholder="1000"
                    className="pl-10"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="max_travelers">Max Travelers</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="max_travelers"
                    type="number"
                    min="1"
                    className="pl-10"
                    value={formData.max_travelers}
                    onChange={(e) => setFormData({ ...formData, max_travelers: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="essentials">Essentials (comma separated)</Label>
              <Input
                id="essentials"
                placeholder="e.g., Passport, Travel insurance, Warm clothes"
                value={formData.essentials}
                onChange={(e) => setFormData({ ...formData, essentials: e.target.value })}
              />
            </div>

            <div>
              <Label>Trip Images</Label>
              <div className="mt-2">
                <label htmlFor="images" className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Click to upload images</p>
                  </div>
                  <input
                    id="images"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      <img src={image} alt={`Upload ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Posting..." : "Post Trip"}
        </Button>
      </form>
    </div>
  );
};

export default CreateTrip;