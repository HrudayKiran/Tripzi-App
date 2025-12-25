import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Lightbulb, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const SuggestFeature = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [sending, setSending] = useState(false);

  const categories = [
    { label: "Trip Planning", icon: "🗺️" },
    { label: "Messaging", icon: "💬" },
    { label: "Profile", icon: "👤" },
    { label: "Payments", icon: "💳" },
    { label: "Other", icon: "✨" },
  ];

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both title and description",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Thank you! 🎉",
      description: "Your feature suggestion has been submitted. We appreciate your feedback!",
    });
    
    setTitle("");
    setDescription("");
    setCategory("");
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Suggest a Feature</h1>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Hero Section */}
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto flex items-center justify-center mb-4">
            <Lightbulb className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Have an idea?</h2>
          <p className="text-muted-foreground text-sm">
            We'd love to hear your suggestions to make Tripzi even better!
          </p>
        </div>

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

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Feature Title</label>
            <Input
              placeholder="e.g., Dark mode support"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              placeholder="Describe your feature idea in detail. What problem does it solve? How should it work?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[150px] rounded-xl"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full rounded-xl gap-2"
            disabled={sending}
          >
            <Star className="h-4 w-4" />
            {sending ? "Submitting..." : "Submit Suggestion"}
          </Button>
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-2">💡 Tips for great suggestions</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Be specific about what you want</li>
            <li>• Explain the problem it solves</li>
            <li>• Describe how it would work</li>
            <li>• Include examples if possible</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SuggestFeature;