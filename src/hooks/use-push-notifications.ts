import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isRegistered: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  register: () => Promise<void>;
  unregister: () => Promise<void>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  
  const isSupported = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  const saveToken = useCallback(async (token: string) => {
    if (!user) return;

    try {
      // Upsert the token (insert or update if exists)
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: user.id,
            token,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) throw error;
      setIsRegistered(true);
      console.log('Push token saved successfully');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, [user, platform]);

  const removeToken = useCallback(async (token: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) throw error;
      setIsRegistered(false);
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }, [user]);

  const register = useCallback(async () => {
    if (!isSupported) {
      console.log('Push notifications not supported on this platform');
      return;
    }

    try {
      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      setPermissionStatus(permStatus.receive as 'prompt' | 'granted' | 'denied');

      if (permStatus.receive !== 'granted') {
        toast.error('Push notification permission denied');
        return;
      }

      // Register with APNS/FCM
      await PushNotifications.register();
      
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      toast.error('Failed to enable push notifications');
    }
  }, [isSupported]);

  const unregister = useCallback(async () => {
    if (!isSupported) return;

    try {
      // Note: Capacitor doesn't have a direct unregister method
      // We'll remove the token from our database
      const tokens = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', user?.id);
      
      if (tokens.data) {
        for (const t of tokens.data) {
          await removeToken(t.token);
        }
      }
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }, [isSupported, user, removeToken]);

  useEffect(() => {
    if (!isSupported || !user) return;

    // Listen for registration success
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      saveToken(token.value);
    });

    // Listen for registration errors
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      toast.error('Failed to register for notifications');
    });

    // Listen for incoming notifications when app is in foreground
    const notificationListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        toast.info(notification.title || 'New notification', {
          description: notification.body,
        });
      }
    );

    // Listen for notification tap/action
    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push notification action performed:', action);
        // Handle navigation based on notification data
        const data = action.notification.data;
        if (data?.type === 'new_trip' && data?.tripId) {
          window.location.href = `/trip/${data.tripId}`;
        } else if (data?.type === 'new_message' && data?.userId) {
          window.location.href = `/chat/${data.userId}`;
        }
      }
    );

    // Check initial permission status
    PushNotifications.checkPermissions().then((status) => {
      setPermissionStatus(status.receive as 'prompt' | 'granted' | 'denied');
    });

    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      notificationListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isSupported, user, saveToken]);

  return {
    isSupported,
    isRegistered,
    permissionStatus,
    register,
    unregister,
  };
};
