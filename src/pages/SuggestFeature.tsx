import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Lightbulb, Bug, Star, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SuggestFeature = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"feature" | "bug">("feature");
  const [severity, setSeverity] = useState("");
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const featureCategories = [
    { label: "Trip Planning", icon: "🗺️" },
    { label: "Messaging", icon: "💬" },
    { label: "Profile", icon: "👤" },
    { label: "Payments", icon: "💳" },
    { label: "Other", icon: "✨" },
  ];

  const bugCategories = [
    { label: "Crash/Freeze", icon: "💥" },
    { label: "UI/Display", icon: "🖼️" },
    { label: "Login/Auth", icon: "🔐" },
    { label: "Data Issues", icon: "📊" },
    { label: "Performance", icon: "⚡" },
    { label: "Other", icon: "🐛" },
  ];

  const severityLevels = [
    { label: "Low", color: "bg-green-500/20 text-green-700 dark:text-green-400" },
    { label: "Medium", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
    { label: "High", color: "bg-orange-500/20 text-orange-700 dark:text-orange-400" },
    { label: "Critical", color: "bg-red-500/20 text-red-700 dark:text-red-400" },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages = Array.from(files).slice(0, 5 - images.length).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImages([...images, ...newImages]);
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const removed = images[index];
    URL.revokeObjectURL(removed.preview);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to submit feedback",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() || !description.trim() || !category) {
      toast({
        title: "Missing information",
        description: "Please fill in title, description, and category",
        variant: "destructive",
      });
      return;
    }

    if (type === "bug" && !severity) {
      toast({
        title: "Missing severity",
        description: "Please select a severity level for the bug",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Create feedback entry
      const { data: feedback, error: feedbackError } = await supabase
        .from("feedback")
        .insert({
          user_id: user.id,
          type,
          category,
          severity: type === "bug" ? severity.toLowerCase() : null,
          title: title.trim(),
          description: description.trim(),
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // Upload images if any
      if (images.length > 0 && feedback) {
        for (const image of images) {
          const fileExt = image.file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('feedback-images')
            .upload(fileName, image.file);

          if (uploadError) {
            console.error("Image upload error:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('feedback-images')
            .getPublicUrl(fileName);

          await supabase.from("feedback_images").insert({
            feedback_id: feedback.id,
            image_url: publicUrl,
          });
        }
      }
      
      toast({
        title: "Thank you! 🎉",
        description: type === "bug" 
          ? "Your bug report has been submitted. Our team will look into it!"
          : "Your feature suggestion has been submitted. We appreciate your feedback!",
      });
      
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setSeverity("");
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const categories = type === "feature" ? featureCategories : bugCategories;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Feedback</h1>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Type Selection Tabs */}
        <Tabs value={type} onValueChange={(v) => setType(v as "feature" | "bug")} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="feature" className="flex-1 gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggest Feature
            </TabsTrigger>
            <TabsTrigger value="bug" className="flex-1 gap-2">
              <Bug className="h-4 w-4" />
              Report Bug
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feature" className="mt-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto flex items-center justify-center mb-3">
                <Lightbulb className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-lg font-bold mb-1">Have an idea?</h2>
              <p className="text-muted-foreground text-sm">
                We'd love to hear your suggestions!
              </p>
            </div>
          </TabsContent>

          <TabsContent value="bug" className="mt-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full mx-auto flex items-center justify-center mb-3">
                <Bug className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-lg font-bold mb-1">Found a bug?</h2>
              <p className="text-muted-foreground text-sm">
                Help us improve by reporting issues
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Category Selection */}
        <div>
          <label className="text-sm font-medium mb-3 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setCategory(cat.label)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity Selection (only for bugs) */}
        {type === "bug" && (
          <div>
            <label className="text-sm font-medium mb-3 block">Severity</label>
            <div className="flex flex-wrap gap-2">
              {severityLevels.map((level) => (
                <button
                  key={level.label}
                  onClick={() => setSeverity(level.label)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    severity === level.label
                      ? level.color + " ring-2 ring-offset-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {type === "bug" ? "Bug Title" : "Feature Title"}
            </label>
            <Input
              placeholder={type === "bug" ? "e.g., App crashes when..." : "e.g., Dark mode support"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              placeholder={type === "bug" 
                ? "Describe what happened, what you expected, and steps to reproduce..."
                : "Describe your feature idea in detail. What problem does it solve?"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] rounded-xl"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Screenshots (optional, max 5)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            
            <div className="flex flex-wrap gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add</span>
                </button>
              )}
            </div>
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full rounded-xl gap-2"
            disabled={sending}
          >
            {type === "bug" ? <Bug className="h-4 w-4" /> : <Star className="h-4 w-4" />}
            {sending ? "Submitting..." : type === "bug" ? "Submit Bug Report" : "Submit Suggestion"}
          </Button>
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-2">
            {type === "bug" ? "🐛 Bug reporting tips" : "💡 Tips for great suggestions"}
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            {type === "bug" ? (
              <>
                <li>• Describe what you expected to happen</li>
                <li>• Include steps to reproduce the issue</li>
                <li>• Add screenshots if helpful</li>
                <li>• Mention your device/browser if relevant</li>
              </>
            ) : (
              <>
                <li>• Be specific about what you want</li>
                <li>• Explain the problem it solves</li>
                <li>• Describe how it would work</li>
                <li>• Include examples if possible</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SuggestFeature;