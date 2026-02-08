
import React from 'react';
import { Alert, Linking } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import AppNavigator from './src/navigation/AppNavigator';
import usePushNotifications from './src/hooks/usePushNotifications';

export default function App() {
  // Initialize push notification listeners
  // Initialize push notification listeners in AppNavigator/AppTabs to access ToastContext
  // usePushNotifications();

  // Check for App Updates
  React.useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const settingsDoc = await firestore().doc('config/app_settings').get();
        // Check for data directly to avoid ambiguous 'exists' check
        const data = settingsDoc.data();
        if (data) {
          const { minVersion, latestVersion, storeUrl } = data;
          const currentVersion = "1.0.0";


          if (latestVersion && latestVersion !== currentVersion) {
            Alert.alert(
              'Update Available 🚀',
              'A new version of Tripzi is available! Please update for the best experience.',
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Update Now',
                  onPress: () => Linking.openURL(storeUrl || 'market://details?id=com.tripzi.app')
                }
              ]
            );
          }
        }
      } catch (e) {
        console.log('Version check failed', e);
      }
    };

    checkAppVersion();
  }, []);

  return <AppNavigator />;
}
