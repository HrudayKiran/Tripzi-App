import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationProvider } from '@react-navigation/native';
import { NetworkProvider } from '../src/contexts/NetworkContext';
import OfflineBanner from '../src/components/OfflineBanner';
import { NotificationToast } from '../src/components/NotificationToast';
import React from 'react';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database, resetDatabase } from '../src/database';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // Data stays fresh for 30 seconds
      gcTime: 10 * 60_000,     // Cache kept for 10 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});
import { syncDatabase } from '../src/database/sync';
import { useAppCheck } from '../src/hooks/useAppCheck';
import { useRemoteConfig } from '../src/hooks/useRemoteConfig';
import { usePresence } from '../src/hooks/usePresence';
import { supabase } from '../src/lib/supabase';
import { useNotificationStore } from '../src/store/notificationStore';
import {
  registerPushToken,
  unregisterPushToken,
  setupTokenRefreshListener,
  setupForegroundHandler,
  setupNotificationTapHandler,
  handleInitialNotification,
} from '../src/services/notificationService';
import { createNotificationChannels, clearBadgeCount } from '../src/services/notificationChannels';
import ErrorBoundary from '../src/components/ErrorBoundary';

function AppNavigator() {
  usePresence();
  const { isDarkMode, colors } = useTheme();

  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="chat" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="trip" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="profile" options={{ contentStyle: { backgroundColor: colors.background } }} />
      </Stack>
    </NavigationProvider>
  );
}

export default function RootLayout() {
  const currentVersion = '1.0.0';

  // Initialize Firebase App Check
  useAppCheck();

  // Initialize Firebase Remote Config for version checking
  useRemoteConfig(currentVersion);

  // Initial Sync & Login Sync Listener + Notification Setup
  React.useEffect(() => {
    // Create notification channels on app startup (idempotent, required for Android 8+)
    createNotificationChannels().catch(() => { });

    // Clear badge count when app opens
    clearBadgeCount().catch(() => { });

    // Initial sync on app boot
    syncDatabase().catch(() => { });

    // Sync automatically when auth state transitions to SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (__DEV__) console.log('[RootLayout] User signed in or token refreshed, running syncDatabase...');
        queryClient.clear();
        syncDatabase().catch(() => { });

        // Register FCM push token with backend (only on SIGNED_IN, not TOKEN_REFRESHED)
        // Delay to let Activity fully mount — Android 13+ needs Activity ready for permission dialog
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            registerPushToken().catch(() => { });
          }, 2000);
        }
      } else if (event === 'SIGNED_OUT') {
        if (__DEV__) console.log('[RootLayout] User signed out, clearing private data...');
        // Unregister push token before clearing data (fire-and-forget)
        unregisterPushToken().catch(() => { });
        queryClient.clear();
        resetDatabase().catch(() => { });
      }
    });

    // Setup FCM token refresh listener
    const unsubTokenRefresh = setupTokenRefreshListener();

    return () => {
      subscription.unsubscribe();
      unsubTokenRefresh();
    };
  }, []);

  // Initialize Firebase Analytics/Crashlytics/Perf
  React.useEffect(() => {
    const initFirebase = async () => {
      try {
        await analytics().logAppOpen();
        const trace = await perf().startTrace('app_start');
        trace.stop();
        crashlytics().log('App started');
      } catch (e) {
        // Firebase services init error
      }
    };

    initFirebase();
  }, []);

  // Foreground push notification handler + tap handlers
  React.useEffect(() => {
    const { showToast } = useNotificationStore.getState();

    // Show in-app toast when push arrives while app is open
    const unsubForeground = setupForegroundHandler(showToast);

    // Navigate when user taps a notification from background state
    const unsubTap = setupNotificationTapHandler((route, params) => {
      // Use setTimeout to ensure navigation is ready
      setTimeout(() => {
        try {
          const router = require('expo-router').router;
          router.push({ pathname: route as any, params });
        } catch (e) {
          if (__DEV__) console.error('[Notifications] Navigation error:', e);
        }
      }, 500);
    });

    // Check if app was opened from killed state via notification tap
    handleInitialNotification((route, params) => {
      try {
        const router = require('expo-router').router;
        router.push({ pathname: route as any, params });
      } catch (e) {
        if (__DEV__) console.error('[Notifications] Initial navigation error:', e);
      }
    });

    // Handle Notifee foreground events (user taps system notification while app is open)
    let unsubNotifee: (() => void) | undefined;
    try {
      const notifee = require('@notifee/react-native').default;
      const { EventType } = require('@notifee/react-native');
      unsubNotifee = notifee.onForegroundEvent(({ type, detail }: any) => {
        if (type === EventType.PRESS && detail?.notification?.data) {
          const data = detail.notification.data as Record<string, string>;
          if (data.deepLinkRoute) {
            let params: Record<string, any> | undefined;
            if (data.deepLinkParams) {
              try { params = JSON.parse(data.deepLinkParams); } catch {}
            }
            setTimeout(() => {
              try {
                const router = require('expo-router').router;
                router.push({ pathname: data.deepLinkRoute as any, params });
              } catch {}
            }, 300);
          }
          // Clear badge when user interacts with notification
          clearBadgeCount().catch(() => {});
        }
      });
    } catch {
      // Notifee not available
    }

    return () => {
      unsubForeground();
      unsubTap();
      unsubNotifee?.();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DatabaseProvider database={database}>
          <ThemeProvider>
            <NetworkProvider>
              <AppNavigator />
              <OfflineBanner />
              <NotificationToast />
            </NetworkProvider>
          </ThemeProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
