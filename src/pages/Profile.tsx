import { useNavigate } from "react-router-dom";
import { Settings, ChevronRight, LogOut, MapIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-semibold">Profile</h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Profile Section */}
        <div className="p-6 text-center space-y-3">
          <Avatar className="w-32 h-32 mx-auto">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-accent text-4xl">
              {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{profile?.full_name || 'User'}</h2>
            <p className="text-muted-foreground">{user?.email || ''}</p>
            {profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>}
          </div>
        </div>

        {/* Menu Options */}
        <div className="px-6 space-y-1">
          {/* My Trips */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => navigate('/trips')}
          >
            <div className="flex items-center gap-3">
              <MapIcon className="h-5 w-5 text-primary" />
              <span className="text-base font-medium">My Trips</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* KYC Status */}
          <button className="w-full flex items-center justify-between py-4 border-b">
            <span className="text-base font-medium">KYC Status</span>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </button>

          {/* Update Profile Details */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => navigate('/update-profile')}
          >
            <span className="text-base font-medium">Update Profile Details</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Privacy Policy */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => navigate('/privacy-policy')}
          >
            <span className="text-base font-medium">Privacy Policy</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Terms and Conditions */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => navigate('/terms')}
          >
            <span className="text-base font-medium">Terms and Conditions</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Suggest a New Feature */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => window.open('mailto:support@tripzi.com?subject=Feature Suggestion', '_blank')}
          >
            <span className="text-base font-medium">Suggest a New Feature</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Settings */}
          <button 
            className="w-full flex items-center justify-between py-4 border-b"
            onClick={() => navigate('/settings')}
          >
            <span className="text-base font-medium">Settings</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Go Ad-Free */}
        <div className="px-6 mt-6">
          <h3 className="text-lg font-bold mb-3">Go Ad-Free</h3>
          <div className="flex items-center justify-between py-3">
            <span className="text-base">Ad-Free Subscription</span>
            <Button variant="secondary" size="sm" className="rounded-full px-6">
              Subscribe
            </Button>
          </div>
        </div>

        {/* App Version */}
        <div className="px-6 mt-4 text-center">
          <p className="text-sm text-primary">Current App Version: 1.2.3</p>
        </div>

        {/* Logout */}
        <div className="px-6 mt-6 mb-6">
          <Button variant="outline" className="w-full py-6 text-base rounded-full" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;