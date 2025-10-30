import { useState } from "react";
import { Mail, Phone, User, LogOut, Moon, Sun, Bell, Shield, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";

const Profile = () => {
  const { theme, setTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);

  const handleLogout = () => {
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen pb-20 bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent p-6 text-center">
        <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary-foreground animate-scale-in">
          <AvatarImage src="" />
          <AvatarFallback className="bg-secondary text-2xl">JD</AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-bold text-primary-foreground">John Doe</h1>
        <p className="text-sm text-primary-foreground/90">@johndoe</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Profile Info */}
        <Card className="animate-fade-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Profile Information</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="name" 
                  defaultValue="John Doe" 
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email"
                  defaultValue="john@example.com" 
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="phone" 
                  defaultValue="+1 234 567 8900" 
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>
            {isEditing && (
              <Button className="w-full">Save Changes</Button>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle theme</p>
                </div>
              </div>
              <Switch 
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">Push notifications</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            
            <Separator />
            
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Shield className="h-5 w-5" />
              <span>Privacy & Security</span>
            </Button>
            
            <Button variant="ghost" className="w-full justify-start gap-3">
              <HelpCircle className="h-5 w-5" />
              <span>Help & Support</span>
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button 
          variant="destructive" 
          className="w-full gap-2 animate-fade-up" 
          style={{ animationDelay: "200ms" }}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Profile;
