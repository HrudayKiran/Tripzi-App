import { useNavigate } from "react-router-dom";
import { 
  Settings, 
  ChevronRight, 
  LogOut, 
  MapIcon, 
  ShieldCheck, 
  ShieldX, 
  Clock, 
  FileText, 
  Lightbulb,
  CreditCard,
  HelpCircle,
  Users
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [testUsers, setTestUsers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([]);
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchCounts();
      fetchAllUsers();
    }
  }, [user, navigate]);

  const fetchCounts = async () => {
    if (!user) return;
    
    const [followersRes, followingRes, tripsRes] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact" }).eq("following_id", user.id),
      supabase.from("follows").select("id", { count: "exact" }).eq("follower_id", user.id),
      supabase.from("trips").select("id", { count: "exact" }).eq("user_id", user.id),
    ]);

    setFollowersCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setTripsCount(tripsRes.count || 0);
  };

  const fetchAllUsers = async () => {
    // Fetch all users for switch account feature
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .order("full_name");
    
    if (data) {
      setTestUsers(data.filter(u => u.id !== user?.id));
    }
  };

  const handleSwitchAccount = async (userId: string) => {
    // For demo purposes, we need to sign in as the test user
    // This requires the test user credentials
    toast({
      title: "Switch Account",
      description: "To switch accounts, you need to sign out and sign in with the other account's credentials.",
    });
    setShowSwitchSheet(false);
  };

  const handleLogout = async () => {
    await signOut();
  };

  const menuItems = [
    {
      icon: MapIcon,
      label: "My Trips",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      onClick: () => navigate('/trips'),
    },
    {
      icon: Users,
      label: "Switch Account",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      onClick: () => setShowSwitchSheet(true),
    },
    {
      icon: profile?.kyc_status === 'verified' ? ShieldCheck : profile?.kyc_status === 'rejected' ? ShieldX : Clock,
      label: "KYC Status",
      color: profile?.kyc_status === 'verified' ? "text-green-500" : profile?.kyc_status === 'rejected' ? "text-destructive" : "text-amber-500",
      bgColor: profile?.kyc_status === 'verified' ? "bg-green-500/10" : profile?.kyc_status === 'rejected' ? "bg-destructive/10" : "bg-amber-500/10",
      badge: profile?.kyc_status === 'verified' ? 'Verified' : profile?.kyc_status === 'rejected' ? 'Rejected' : 'Pending',
      badgeVariant: profile?.kyc_status === 'verified' ? 'default' : profile?.kyc_status === 'rejected' ? 'destructive' : 'secondary',
    },
    {
      icon: FileText,
      label: "Privacy Policy",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      onClick: () => navigate('/privacy-policy'),
    },
    {
      icon: FileText,
      label: "Terms and Conditions",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
      onClick: () => navigate('/terms'),
    },
    {
      icon: Lightbulb,
      label: "Suggest a New Feature",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      onClick: () => {
        const email = 'support@tripzi.com';
        const subject = encodeURIComponent('Feature Suggestion for Tripzi');
        const body = encodeURIComponent('Hi Tripzi Team,\n\nI would like to suggest the following feature:\n\n');
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      },
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      onClick: () => {
        const email = 'support@tripzi.com';
        const subject = encodeURIComponent('Help & Support Request');
        const body = encodeURIComponent('Hi Tripzi Team,\n\nI need help with:\n\n');
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      },
    },
    {
      icon: Settings,
      label: "Settings",
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-semibold">Profile</h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Profile Section */}
        <div className="p-6 text-center space-y-4 animate-fade-in">
          <div 
            className="relative inline-block cursor-pointer" 
            onClick={() => user && navigate(`/profile/${user.id}`)}
          >
            <Avatar className="w-28 h-28 mx-auto ring-4 ring-primary/20 shadow-lg hover:ring-primary/40 transition-all">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground text-3xl">
                {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-success rounded-full flex items-center justify-center border-4 border-background">
              <div className="w-3 h-3 bg-success-foreground rounded-full animate-pulse" />
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold">{profile?.full_name || 'User'}</h2>
            <p className="text-muted-foreground">{user?.email || ''}</p>
            {profile?.bio && <p className="text-sm mt-2 max-w-xs mx-auto">{profile.bio}</p>}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 py-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{tripsCount}</p>
              <p className="text-xs text-muted-foreground">Trips</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="px-4 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="w-full flex items-center justify-between p-4 bg-card rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={item.onClick}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <span className="text-base font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <Badge 
                    variant={item.badgeVariant as any}
                    className={item.badgeVariant === 'default' ? 'bg-success' : ''}
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.onClick && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
              </div>
            </button>
          ))}
        </div>

        {/* Go Ad-Free */}
        <div className="px-4 mt-6">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 rounded-2xl p-5 animate-fade-up" style={{ animationDelay: "500ms" }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">Go Ad-Free</h3>
                <p className="text-sm text-muted-foreground">Enjoy premium experience</p>
              </div>
              <Button variant="default" size="sm" className="rounded-full px-5 shadow-lg">
                Upgrade
              </Button>
            </div>
          </div>
        </div>

        {/* App Version */}
        <div className="px-4 mt-6 text-center">
          <p className="text-sm text-muted-foreground">Tripzi v1.2.3</p>
        </div>

        {/* Logout */}
        <div className="px-4 mt-4 mb-6">
          <Button 
            variant="outline" 
            className="w-full py-6 text-base rounded-2xl gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Switch Account Sheet */}
      <Sheet open={showSwitchSheet} onOpenChange={setShowSwitchSheet}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Switch Account</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Other users in the app. To switch, you'll need to sign out and sign in with their credentials.
            </p>
            {testUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No other users found</p>
            ) : (
              testUsers.map((testUser) => (
                <div
                  key={testUser.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/profile/${testUser.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={testUser.avatar_url || ""} />
                      <AvatarFallback>{testUser.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{testUser.full_name || "User"}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full">
                    View Profile
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Profile;
