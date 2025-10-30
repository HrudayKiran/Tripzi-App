import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (profile) {
      setPushNotifications(profile.push_notifications_enabled);
    }
  }, [profile]);

  const handlePushNotificationsToggle = async (checked: boolean) => {
    setPushNotifications(checked);
    const { error } = await updateProfile({ push_notifications_enabled: checked });
    
    if (error) {
      toast.error('Failed to update notification settings');
      setPushNotifications(!checked);
    } else {
      toast.success(`Push notifications ${checked ? 'enabled' : 'disabled'}`);
    }
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
    toast.success(`Switched to ${checked ? 'dark' : 'light'} mode`);
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between py-4 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications" className="text-base font-medium cursor-pointer">
              Push Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications about your trips and updates
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={pushNotifications}
            onCheckedChange={handlePushNotificationsToggle}
          />
        </div>

        <div className="flex items-center justify-between py-4 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="dark-mode" className="text-base font-medium cursor-pointer">
              Dark Mode
            </Label>
            <p className="text-sm text-muted-foreground">
              Toggle between light and dark theme
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="dark-mode"
              checked={theme === 'dark'}
              onCheckedChange={handleThemeToggle}
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;