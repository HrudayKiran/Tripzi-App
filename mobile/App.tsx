import React from 'react';
import { Alert, Linking } from 'react-native';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeAppCheck } from './src/hooks/useAppCheck';
import { compareVersions } from './src/utils/version';
import { supabase } from './src/lib/supabase';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from './src/database';
import { syncDatabase } from './src/database/sync';

export default function App() {
  const currentVersion = '1.0.0';

  // Initial Sync
  React.useEffect(() => {
    syncDatabase().catch(() => { });
  }, []);

  // Check for App Updates
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
    initializeAppCheck().catch(() => { });

    const checkAppVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('min_version, latest_version, store_url')
          .eq('id', 'app_settings')
          .maybeSingle();

        if (error || !data) return;

        const { min_version: minVersion, latest_version: latestVersion, store_url: storeUrl } = data;
        const effectiveStoreUrl = storeUrl || 'market://details?id=com.tripzi.app';
        const isBelowMinVersion = typeof minVersion === 'string' && compareVersions(currentVersion, minVersion) < 0;
        const isUpdateAvailable = typeof latestVersion === 'string' && compareVersions(currentVersion, latestVersion) < 0;

        if (isBelowMinVersion) {
          Alert.alert(
            'Update Required',
            'Your app version is no longer supported. Please update to continue.',
            [
              {
                text: 'Update Now',
                onPress: () => Linking.openURL(effectiveStoreUrl)
              }
            ],
            { cancelable: false }
          );
          return;
        }

        if (isUpdateAvailable) {
          Alert.alert(
            'Update Available 🚀',
            'A new version of Tripzi is available! Please update for the best experience.',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update Now',
                onPress: () => Linking.openURL(effectiveStoreUrl)
              }
            ]
          );
        }
      } catch (e) {
        // Error checking app version
      }
    };

    checkAppVersion();
  }, []);

  const DatabaseProviderAny = DatabaseProvider as any;

  return (
    <DatabaseProviderAny database={database}>
      <AppNavigator />
    </DatabaseProviderAny>
  );
}
