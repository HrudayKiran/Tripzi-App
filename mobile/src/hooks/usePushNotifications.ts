import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from '../lib/supabase';
import * as RootNavigation from '../navigation/RootNavigation';
import { resolveNotificationTarget } from '../utils/notificationNavigation';

interface NotificationData {
  route?: string;
  tripId?: string;
  chatId?: string;
  userId?: string;
  url?: string;
  [key: string]: string | undefined;
}

const usePushNotifications = () => {
  const hasHandledInitialNotification = useRef(false);

  useEffect(() => {
    let unsubscribeMessage: (() => void) | null = null;
    let unsubscribeOpenedApp: (() => void) | null = null;

    const setup = async () => {
      try {
        // Handle notification that opened the app from quit state
        const handleInitialNotification = async () => {
          if (hasHandledInitialNotification.current) return;
          hasHandledInitialNotification.current = true;

          const remoteMessage = await messaging().getInitialNotification();
          if (remoteMessage?.data) {
            setTimeout(() => {
              void handleNotificationNavigation(remoteMessage.data as NotificationData);
            }, 1000);
          }
        };

        // Handle notification tap when app is in background
        unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
          if (remoteMessage?.data) {
            void handleNotificationNavigation(remoteMessage.data as NotificationData);
          }
        });

        // Handle foreground messages — FCM data messages are received here
        unsubscribeMessage = messaging().onMessage(async (_remoteMessage) => {
          // FCM notification messages are automatically displayed by the system
          // on Android when the notification key is present in the payload.
          // No additional handling needed for display.
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            if (session?.user) {
              await registerFCMToken(session.user);
              handleInitialNotification();
            }
          }
        );

        // Check current session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await registerFCMToken(user);
          handleInitialNotification();
        }

        // Return cleanup for auth subscription
        return () => subscription.unsubscribe();
      } catch {
        // Push setup should not crash the app
      }
    };

    const registerFCMToken = async (user: any) => {
      try {
        // Request permission (required for iOS, Android 13+)
        const authStatus = await messaging().requestPermission();
        const isEnabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!isEnabled) return;

        // Check if user has push notifications enabled in their profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('push_notifications_enabled')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.push_notifications_enabled !== true) return;

        // Get native FCM token
        const token = await messaging().getToken();
        if (!token) return;

        // Save token to Supabase
        await supabase
          .from('push_tokens')
          .upsert(
            {
              user_id: user.id,
              token,
              platform: Platform.OS,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' }
          );
      } catch {
        // Token registration is non-critical
      }
    };

    setup();

    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeOpenedApp) unsubscribeOpenedApp();
    };
  }, []);

  const handleNotificationNavigation = async (data: NotificationData) => {
    const route = data.route;
    if (!route) return;

    const navigate = (name: string, params?: any) => {
      try {
        RootNavigation.navigate(name, params);
      } catch { /* silent */ }
    };

    const target = await resolveNotificationTarget({
      deepLinkRoute: route,
      deepLinkParams: {
        tripId: data.tripId,
        chatId: data.chatId,
        userId: data.userId,
        url: data.url,
      },
      entityId: data.tripId || data.chatId || data.userId || null,
      entityType: data.chatId ? 'chat' : data.tripId ? 'trip' : data.userId ? 'user' : null,
    });

    if (!target) return;

    if (target.route === 'ExternalLink') {
      const { Linking } = require('react-native');
      const url = target.params?.url;
      if (typeof url === 'string' && url.length > 0) {
        Linking.openURL(url).catch(() => { });
      }
      return;
    }

    navigate(target.route, target.params || {});
  };
};

export default usePushNotifications;
