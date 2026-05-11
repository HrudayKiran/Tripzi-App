import React from 'react';
import { Alert, Linking } from 'react-native';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';
import AppNavigator from './src/navigation/AppNavigator';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from './src/database';
import { syncDatabase } from './src/database/sync';
import { registerBackgroundHandler } from './src/utils/notifications';
import { useAppCheck } from './src/hooks/useAppCheck';
import { useRemoteConfig } from './src/hooks/useRemoteConfig';

// Register FCM background message handler
registerBackgroundHandler();

export default function App() {
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
      <AppNavigator />
    </DatabaseProvider>
  );
}
