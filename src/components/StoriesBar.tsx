import { useState, useEffect, useRef } from "react";
import { Plus, X, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
}

interface StoryGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

export const StoriesBar = () => {
  const { user, profile } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryGroup, setCurrentStoryGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStories();
    const interval = setInterval(fetchStories, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStories = async () => {
    try {
      const { data: storiesData } = await supabase
        .from("stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (storiesData && storiesData.length > 0) {
        const userIds = [...new Set(storiesData.map((s) => s.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        profilesData?.forEach((p) => {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });

        const groupedStories: Record<string, StoryGroup> = {};
        storiesData.forEach((story) => {
          if (!groupedStories[story.user_id]) {
            groupedStories[story.user_id] = {
              userId: story.user_id,
              userName: profilesMap[story.user_id]?.full_name || "User",
              avatarUrl: profilesMap[story.user_id]?.avatar_url,
              stories: [],
              hasUnviewed: true,
            };
          }
          groupedStories[story.user_id].stories.push(story);
        });

        setStoryGroups(Object.values(groupedStories));
      } else {
        setStoryGroups([]);
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setShowUploadDialog(true);
    }
  };

  const handleUploadStory = async () => {
    if (!user || !selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("stories").getPublicUrl(fileName);

      await supabase.from("stories").insert({
        user_id: user.id,
        image_url: urlData.publicUrl,
        caption: caption || null,
      });

      toast({ title: "Story uploaded!", description: "Your story is now visible to everyone" });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption("");
      fetchStories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload story", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const openStoryViewer = (group: StoryGroup) => {
    setCurrentStoryGroup(group);
    setCurrentStoryIndex(0);
    setShowStoryViewer(true);
  };

  const nextStory = () => {
    if (!currentStoryGroup) return;
    if (currentStoryIndex < currentStoryGroup.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else {
      setShowStoryViewer(false);
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-3 py-3">
          {/* Add Story Button */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-dashed border-primary/40 hover:border-primary transition-colors"
            >
              {profile?.avatar_url ? (
                <>
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback>{profile.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <Plus className="h-3 w-3 text-primary-foreground" />
                  </div>
                </>
              ) : (
                <Plus className="h-6 w-6 text-primary" />
              )}
            </button>
            <span className="text-[10px] text-muted-foreground">Your Story</span>
          </div>

          {/* Story Groups */}
          {storyGroups.map((group) => (
            <div
              key={group.userId}
              onClick={() => openStoryViewer(group)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            >
              <div className={`p-0.5 rounded-full ${group.hasUnviewed ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600" : "bg-muted"}`}>
                <Avatar className="w-14 h-14 border-2 border-background">
                  <AvatarImage src={group.avatarUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {group.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[10px] text-muted-foreground max-w-14 truncate">
                {group.userName.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add to Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewUrl && (
              <div className="relative aspect-[9/16] max-h-80 rounded-xl overflow-hidden bg-muted">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="rounded-xl"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadStory}
                disabled={uploading}
                className="flex-1 rounded-xl"
              >
                {uploading ? "Uploading..." : "Share Story"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Viewer */}
      <Dialog open={showStoryViewer} onOpenChange={setShowStoryViewer}>
        <DialogContent className="max-w-md mx-auto p-0 rounded-2xl overflow-hidden bg-black">
          {currentStoryGroup && currentStoryGroup.stories[currentStoryIndex] && (
            <div className="relative aspect-[9/16] max-h-[85vh]">
              {/* Progress bars */}
              <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                {currentStoryGroup.stories.map((_, idx) => (
                  <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-white transition-all duration-300 ${idx < currentStoryIndex ? "w-full" : idx === currentStoryIndex ? "w-full" : "w-0"}`}
                    />
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="absolute top-6 left-3 right-3 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 border border-white/20">
                    <AvatarImage src={currentStoryGroup.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{currentStoryGroup.userName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white text-sm font-medium">{currentStoryGroup.userName}</p>
                    <p className="text-white/60 text-[10px]">
                      {getTimeAgo(currentStoryGroup.stories[currentStoryIndex].created_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowStoryViewer(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Story Image */}
              <img
                src={currentStoryGroup.stories[currentStoryIndex].image_url}
                alt="Story"
                className="w-full h-full object-cover"
              />

              {/* Caption */}
              {currentStoryGroup.stories[currentStoryIndex].caption && (
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <p className="text-white text-center text-sm bg-black/50 rounded-lg px-4 py-2">
                    {currentStoryGroup.stories[currentStoryIndex].caption}
                  </p>
                </div>
              )}

              {/* Touch areas for navigation */}
              <div className="absolute inset-0 flex z-10">
                <div className="w-1/3 h-full" onClick={prevStory} />
                <div className="w-2/3 h-full" onClick={nextStory} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
