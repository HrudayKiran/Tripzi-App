import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, DollarSign, Users, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const tripSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100, "Title must be less than 100 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000, "Description must be less than 2000 characters"),
  destination: z.string().trim().min(2, "Destination must be at least 2 characters").max(100, "Destination must be less than 100 characters"),
  cost: z.number().positive("Cost must be positive").max(1000000, "Cost must be less than 1,000,000"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  max_travelers: z.number().int().min(1, "Must have at least 1 traveler").max(50, "Cannot exceed 50 travelers"),
  location_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  essentials: z.string().trim().max(500, "Essentials must be less than 500 characters").optional(),
  gender_preference: z.enum(["Male", "Female", "Male and Female"], "Please select a gender preference"),
  transport_type: z.string().min(1, "Transport type is required")
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: "End date must be after start date",
  path: ["end_date"]
});

const CreateTrip = () => {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
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
    gender_preference: "",
    transport_type: "",
    transport_type_other: "",
  });

  useEffect(() => {
    if (tripId && user) {
      loadTripData();
    }
  }, [tripId, user]);

  const loadTripData = async () => {
    if (!tripId) return;
    
    setLoading(true);
    try {
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .eq("user_id", user?.id)
        .single();

      if (tripError) throw tripError;

      if (trip) {
        setFormData({
          title: trip.title,
          description: trip.description,
          destination: trip.destination,
          location_url: trip.location_url || "",
          cost: trip.cost.toString(),
          start_date: trip.start_date,
          end_date: trip.end_date,
          max_travelers: trip.max_travelers.toString(),
          essentials: Array.isArray(trip.essentials) ? trip.essentials.join(", ") : "",
          gender_preference: trip.gender_preference || "Male and Female",
          transport_type: trip.transport_type || "Other",
          transport_type_other: "",
        });

        // Load existing images
        const { data: tripImages } = await supabase
          .from("trip_images")
          .select("image_url")
          .eq("trip_id", tripId);

        if (tripImages) {
          setExistingImages(tripImages.map(img => img.image_url));
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load trip data",
        variant: "destructive",
      });
      navigate("/feed");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Validate files
      const validFiles = Array.from(files).filter(file => {
        // Check file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid file",
            description: `${file.name} is not an image file`,
            variant: "destructive",
          });
          return false;
        }
        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} is too large (max 5MB)`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        const newImages = validFiles.map(file => ({
          file,
          preview: URL.createObjectURL(file)
        }));
        setImages([...images, ...newImages]);
      }
    }
  };

  const removeImage = (index: number) => {
    const removed = images[index];
    URL.revokeObjectURL(removed.preview);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Validate form data
      const validationResult = tripSchema.safeParse({
        title: formData.title,
        description: formData.description,
        destination: formData.destination,
        cost: parseFloat(formData.cost),
        start_date: formData.start_date,
        end_date: formData.end_date,
        max_travelers: parseInt(formData.max_travelers),
        location_url: formData.location_url,
        essentials: formData.essentials,
        gender_preference: formData.gender_preference,
        transport_type: formData.transport_type || formData.transport_type_other
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
        return;
      }

      // Upload new images to storage
      const uploadedImageUrls: string[] = [];
      
      for (const image of images) {
        const fileExt = image.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('trip-images')
          .upload(fileName, image.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('trip-images')
          .getPublicUrl(uploadData.path);

        uploadedImageUrls.push(publicUrl);
      }

      if (tripId) {
        // Update existing trip
        const { error: tripError } = await supabase
          .from("trips")
          .update({
            title: validationResult.data.title,
            description: validationResult.data.description,
            destination: validationResult.data.destination,
            location_url: validationResult.data.location_url || null,
            cost: validationResult.data.cost,
            start_date: validationResult.data.start_date,
            end_date: validationResult.data.end_date,
            max_travelers: validationResult.data.max_travelers,
            essentials: validationResult.data.essentials ? validationResult.data.essentials.split(",").map(e => e.trim()).filter(Boolean) : [],
            gender_preference: validationResult.data.gender_preference,
            transport_type: validationResult.data.transport_type,
          })
          .eq("id", tripId)
          .eq("user_id", user.id);

        if (tripError) throw tripError;

        // Add new images if any
        if (uploadedImageUrls.length > 0) {
          const imageInserts = uploadedImageUrls.map(imageUrl => ({
            trip_id: tripId,
            image_url: imageUrl,
          }));
          
          const { error: imagesError } = await supabase
            .from("trip_images")
            .insert(imageInserts);

          if (imagesError) throw imagesError;
        }

        toast({
          title: "Success!",
          description: "Your trip has been updated successfully.",
        });
      } else {
        // Create new trip
        const { data: trip, error: tripError } = await supabase
          .from("trips")
          .insert({
            user_id: user.id,
            title: validationResult.data.title,
            description: validationResult.data.description,
            destination: validationResult.data.destination,
            location_url: validationResult.data.location_url || null,
            cost: validationResult.data.cost,
            start_date: validationResult.data.start_date,
            end_date: validationResult.data.end_date,
            max_travelers: validationResult.data.max_travelers,
            essentials: validationResult.data.essentials ? validationResult.data.essentials.split(",").map(e => e.trim()).filter(Boolean) : [],
            gender_preference: validationResult.data.gender_preference,
            transport_type: validationResult.data.transport_type,
          })
          .select()
          .single();

        if (tripError) throw tripError;

        if (uploadedImageUrls.length > 0 && trip) {
          const imageInserts = uploadedImageUrls.map(imageUrl => ({
            trip_id: trip.id,
            image_url: imageUrl,
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
      }

      // Clean up blob URLs
      images.forEach(img => URL.revokeObjectURL(img.preview));

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
          <h1 className="text-2xl font-bold text-primary-foreground">{tripId ? "Edit Trip" : "Create Trip"}</h1>
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
                <Label htmlFor="cost">Estimated Cost (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-3 h-4 w-4 text-muted-foreground">₹</span>
                  <Input
                    id="cost"
                    type="number"
                    placeholder="50000"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gender_preference">Gender Preference</Label>
                <select
                  id="gender_preference"
                  value={formData.gender_preference}
                  onChange={(e) => setFormData({ ...formData, gender_preference: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="" disabled hidden>Select Gender Preference</option>
                  <option value="Male and Female">Male and Female</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <Label htmlFor="transport_type">Transport Type</Label>
                <select
                  id="transport_type"
                  value={formData.transport_type}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "Other") {
                      setFormData({ ...formData, transport_type: "", transport_type_other: formData.transport_type_other });
                    } else {
                      setFormData({ ...formData, transport_type: value, transport_type_other: "" });
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Select Transport Type</option>
                  <option value="Train">Train</option>
                  <option value="Bus">Bus</option>
                  <option value="Bike">Bike</option>
                  <option value="Car">Car</option>
                  <option value="Flight">Flight</option>
                  <option value="Other">Other</option>
                </select>
                {formData.transport_type === "" && (
                  <Input
                    id="transport_type_other"
                    placeholder="Specify other transport type"
                    value={formData.transport_type_other}
                    onChange={(e) => setFormData({ ...formData, transport_type_other: e.target.value })}
                    className="mt-2"
                    required
                  />
                )}
              </div>
            </div>

            <div>
              <Label>Trip Images</Label>
              <div className="mt-2">
                <label htmlFor="images" className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Click to upload images (max 5MB each)</p>
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
                      <img src={image.preview} alt={`Upload ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
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
          {loading ? (tripId ? "Updating..." : "Posting...") : (tripId ? "Update Trip" : "Post Trip")}
        </Button>
      </form>
    </div>
  );
};

export default CreateTrip;
