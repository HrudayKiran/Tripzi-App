import { useNavigate } from "react-router-dom";
import { Menu, Settings, ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const interests = ["Hiking", "Photography", "Foodie", "Culture", "Adventure"];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
  };
  return <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        
        <h1 className="text-xl font-semibold">Profile</h1>
        
      </div>

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

      {/* Interests */}
      

      {/* Menu Options */}
      <div className="px-6 space-y-1">
        {/* KYC Status */}
        <button 
          className="w-full flex items-center justify-between py-4 border-b"
          onClick={() => navigate('/kyc-request')}
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">KYC Status</span>
            {profile?.kyc_status === 'verified' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">Verified</span>
            )}
            {profile?.kyc_status === 'pending' && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pending</span>
            )}
            {profile?.kyc_status === 'rejected' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">Rejected</span>
            )}
            {(!profile?.kyc_status || profile?.kyc_status === 'not_submitted') && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Not Verified</span>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
          onClick={() => window.open('/privacy-policy', '_blank')}
        >
          <span className="text-base font-medium">Privacy Policy</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Terms and Conditions */}
        <button 
          className="w-full flex items-center justify-between py-4 border-b"
          onClick={() => window.open('/terms', '_blank')}
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

        {/* Admin Dashboard */}
        {profile?.role === 'admin' && (
          <button 
            className="w-full flex items-center justify-between py-4 border-b border-primary"
            onClick={() => navigate('/admin/dashboard')}
          >
            <span className="text-base font-medium text-primary">Admin Dashboard</span>
            <ChevronRight className="h-5 w-5 text-primary" />
          </button>
        )}
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
    </div>;
};
export default Profile;