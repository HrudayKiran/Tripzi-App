import { Menu, Settings, ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const Profile = () => {
  const interests = ["Hiking", "Photography", "Foodie", "Culture", "Adventure"];
  const handleLogout = () => {
    window.location.href = "/auth";
  };
  return <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        
        <h1 className="text-xl font-semibold">Profile</h1>
        
      </div>

      {/* Profile Section */}
      <div className="p-6 text-center space-y-3">
        <Avatar className="w-32 h-32 mx-auto">
          <AvatarImage src="" />
          <AvatarFallback className="bg-accent text-4xl">SC</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">Sophia Carter</h2>
          <p className="text-muted-foreground">@sophia_carter</p>
          
        </div>
      </div>

      {/* Interests */}
      

      {/* Menu Options */}
      <div className="px-6 space-y-1">
        {/* KYC Status */}
        <button className="w-full flex items-center justify-between py-4 border-b">
          <span className="text-base font-medium">KYC Status</span>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </button>

        {/* Update Profile Details */}
        <button className="w-full flex items-center justify-between py-4 border-b">
          <span className="text-base font-medium">Update Profile Details</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Privacy Policy */}
        <button className="w-full flex items-center justify-between py-4 border-b">
          <span className="text-base font-medium">Privacy Policy</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Terms and Conditions */}
        <button className="w-full flex items-center justify-between py-4 border-b">
          <span className="text-base font-medium">Terms and Conditions</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Suggest a New Feature */}
        <button className="w-full flex items-center justify-between py-4 border-b">
          <span className="text-base font-medium">Suggest a New Feature</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Settings */}
        <button className="w-full flex items-center justify-between py-4 border-b">
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
    </div>;
};
export default Profile;