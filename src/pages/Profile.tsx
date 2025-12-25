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
  RefreshCw
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SavedAccount {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

const SAVED_ACCOUNTS_KEY = "tripzi_saved_accounts";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      loadSavedAccounts();
      // Save current account
      saveCurrentAccount();
    }
  }, [user, navigate, profile]);

  const loadSavedAccounts = () => {
    try {
      const saved = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      if (saved) {
        const accounts = JSON.parse(saved) as SavedAccount[];
        // Filter out current user
        setSavedAccounts(accounts.filter(a => a.email !== user?.email));
      }
    } catch {
      setSavedAccounts([]);
    }
  };

  const saveCurrentAccount = () => {
    if (!user?.email) return;
    try {
      const saved = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      let accounts: SavedAccount[] = saved ? JSON.parse(saved) : [];
      
      // Update or add current account
      const existingIndex = accounts.findIndex(a => a.email === user.email);
      const currentAccount: SavedAccount = {
        email: user.email,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
      };
      
      if (existingIndex >= 0) {
        accounts[existingIndex] = currentAccount;
      } else {
        accounts.push(currentAccount);
      }
      
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {}
  };

  const handleSwitchToSavedAccount = async (account: SavedAccount) => {
    setLoginEmail(account.email);
    setShowLoginForm(true);
  };

  const handleSwitchToAccount = async () => {
    if (!loginEmail || !loginPassword) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingIn(true);
    try {
      // First sign out
      await signOut();
      
      // Then sign in with new credentials
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Switched account successfully",
      });
      setShowSwitchSheet(false);
      setShowLoginForm(false);
      setLoginEmail("");
      setLoginPassword("");
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to switch account",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
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
      icon: RefreshCw,
      label: "Switch Account",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      onClick: () => {
        setShowSwitchSheet(true);
        setShowLoginForm(false);
        loadSavedAccounts();
      },
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
      onClick: () => navigate('/suggest-feature'),
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      onClick: () => navigate('/help-support'),
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
            {profile?.bio && <p className="text-sm mt-2 max-w-xs mx-auto text-muted-foreground">{profile.bio}</p>}
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
          
          {!showLoginForm ? (
            <div className="py-4 space-y-4">
              {savedAccounts.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Previously signed in:</p>
                  <div className="space-y-2">
                    {savedAccounts.map((account) => (
                      <div
                        key={account.email}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSwitchToSavedAccount(account)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={account.avatar_url || ""} />
                            <AvatarFallback>{account.full_name?.charAt(0) || account.email.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{account.full_name || "User"}</p>
                            <p className="text-xs text-muted-foreground">{account.email}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={() => setShowLoginForm(true)} 
                variant={savedAccounts.length > 0 ? "outline" : "default"}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sign in with different account
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowLoginForm(false)}
                className="mb-2"
              >
                ← Back
              </Button>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={handleSwitchToAccount} 
                  className="w-full"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? "Signing in..." : "Sign In & Switch"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Profile;