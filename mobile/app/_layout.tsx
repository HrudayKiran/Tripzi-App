import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { NetworkProvider } from '../src/contexts/NetworkContext';
import OfflineBanner from '../src/components/OfflineBanner';
import React from 'react';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from '../src/database';
import { syncDatabase } from '../src/database/sync';
import { registerBackgroundHandler } from '../src/utils/notifications';
import { useAppCheck } from '../src/hooks/useAppCheck';
import { useRemoteConfig } from '../src/hooks/useRemoteConfig';

// Register FCM background message handler
registerBackgroundHandler();

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
    <DatabaseProvider database={database}>
      <ThemeProvider>
        <NetworkProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="trip" />
            <Stack.Screen name="profile" />
          </Stack>
          <OfflineBanner />
        </NetworkProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
