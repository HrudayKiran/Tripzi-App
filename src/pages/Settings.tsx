import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isSupported, isRegistered, permissionStatus, register, unregister } = usePushNotifications();
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (profile) {
      setPushNotifications(profile.push_notifications_enabled);
    }
  }, [profile]);

  const handlePushNotificationsToggle = async (checked: boolean) => {
    setPushNotifications(checked);
    
    if (checked) {
      // Enable push notifications
      if (isSupported) {
        await register();
      }
      const { error } = await updateProfile({ push_notifications_enabled: true });
      if (error) {
        toast.error('Failed to enable notifications');
        setPushNotifications(false);
        return;
      }
      toast.success('Push notifications enabled');
    } else {
      // Disable push notifications
      if (isSupported) {
        await unregister();
      }
      const { error } = await updateProfile({ push_notifications_enabled: false });
      if (error) {
        toast.error('Failed to disable notifications');
        setPushNotifications(true);
        return;
      }
      toast.success('Push notifications disabled');
    }
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
    toast.success(`Switched to ${checked ? 'dark' : 'light'} mode`);
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 safe-top">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-display font-semibold">Settings</h1>
        </div>
      </div>

      <div className="p-6 space-y-2">
        {/* Push Notifications */}
        <div className="flex items-center justify-between py-4 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              {pushNotifications ? (
                <Bell className="h-5 w-5 text-accent-foreground" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications" className="text-base font-medium cursor-pointer">
                Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications about new trips and messages
              </p>
              {isSupported && (
                <p className="text-xs text-muted-foreground">
                  Status: {permissionStatus === 'granted' ? '✅ Enabled' : permissionStatus === 'denied' ? '❌ Denied' : '⏳ Not set'}
                </p>
              )}
            </div>
          </div>
          <Switch
            id="push-notifications"
            checked={pushNotifications}
            onCheckedChange={handlePushNotificationsToggle}
          />
        </div>

        {/* Native App Notice */}
        {!isSupported && (
          <div className="flex items-start gap-3 py-4 px-4 bg-muted/50 rounded-2xl">
            <Smartphone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Native Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                Full push notification support is available in the iOS and Android app versions.
              </p>
            </div>
          </div>
        )}

        {/* Dark Mode */}
        <div className="flex items-center justify-between py-4 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-accent-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-accent-foreground" />
              )}
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode" className="text-base font-medium cursor-pointer">
                Dark Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
          </div>
          <Switch
            id="dark-mode"
            checked={theme === 'dark'}
            onCheckedChange={handleThemeToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
