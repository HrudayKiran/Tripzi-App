import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FollowerUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  isFollowing?: boolean;
}

interface FollowersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: "followers" | "following";
}

export const FollowersModal = ({ open, onOpenChange, userId, type }: FollowersModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<FollowerUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchUsers();
    }
  }, [open, userId, type]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let userIds: string[] = [];

      if (type === "followers") {
        const { data } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId);
        userIds = data?.map((f) => f.follower_id) || [];
      } else {
        const { data } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);
        userIds = data?.map((f) => f.following_id) || [];
      }

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesData && user) {
          // Check which users the current user is following
          const { data: followingData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .in("following_id", userIds);

          const followingSet = new Set(followingData?.map((f) => f.following_id) || []);

          setUsers(
            profilesData.map((p) => ({
              ...p,
              isFollowing: followingSet.has(p.id),
            }))
          );
        }
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!user) return;

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId });
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u
        )
      );
    } catch (error) {
      console.error("Error updating follow:", error);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{type === "followers" ? "Followers" : "Following"}</SheetTitle>
        </SheetHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-full"
          />
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[calc(70vh-12rem)]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No users found" : `No ${type} yet`}
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/profile/${u.id}`);
                  }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.avatar_url || ""} />
                    <AvatarFallback>{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{u.full_name || "User"}</span>
                </div>
                {user?.id !== u.id && (
                  <Button
                    variant={u.isFollowing ? "outline" : "default"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleFollow(u.id, !!u.isFollowing)}
                  >
                    {u.isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
