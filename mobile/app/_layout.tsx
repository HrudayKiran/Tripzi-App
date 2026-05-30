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
import { database } from '../src/database';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
import { syncDatabase } from '../src/database/sync';
import { useAppCheck } from '../src/hooks/useAppCheck';
import { useRemoteConfig } from '../src/hooks/useRemoteConfig';
import { usePresence } from '../src/hooks/usePresence';

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

  // Initial Sync
  React.useEffect(() => {
    syncDatabase().catch(() => { });
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

  return (
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
  );
}
