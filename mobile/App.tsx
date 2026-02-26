
import React from 'react';
import { Alert, Linking } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeAppCheck } from './src/hooks/useAppCheck';
import { compareVersions } from './src/utils/version';


export default function App() {
  const currentVersion = '1.0.0';


  // Check for App Updates
  React.useEffect(() => {
    initializeAppCheck().catch(() => { });

    const checkAppVersion = async () => {
      try {
        const settingsDoc = await firestore().doc('config/app_settings').get();
        // Check for data directly to avoid ambiguous 'exists' check
        const data = settingsDoc.data();
        if (data) {
          const { minVersion, latestVersion, storeUrl } = data;
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
        }
      } catch (e) {

      }
    };

    checkAppVersion();
  }, []);

  return <AppNavigator />;
}
