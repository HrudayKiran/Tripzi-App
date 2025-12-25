import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SearchUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
}

interface UserSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserSearchModal = ({ open, onOpenChange }: UserSearchModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [followedUsers, setFollowedUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      fetchFollowedUsers();
    }
  }, [open, user]);

  const fetchFollowedUsers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get users the current user is following
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map((f) => f.following_id);
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", followingIds);

        if (profilesData) {
          setFollowedUsers(
            profilesData.map((p) => ({ ...p, isFollowing: true }))
          );
        }
      } else {
        setFollowedUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = followedUsers.filter((u) =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Search People You Follow
          </SheetTitle>
        </SheetHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-full"
            autoFocus
          />
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[calc(70vh-12rem)]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : followedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>You're not following anyone yet</p>
              <p className="text-sm mt-1">Follow travelers to see their trips!</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching "{searchQuery}"
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/profile/${u.id}`);
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={u.avatar_url || ""} />
                    <AvatarFallback>{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{u.full_name || "User"}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Following
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
