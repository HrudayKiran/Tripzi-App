import { useEffect, useRef } from 'react';
import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Platform, Alert } from 'react-native';
import * as RootNavigation from '../navigation/RootNavigation';

interface NotificationData {
  route?: string;
  tripId?: string;
  chatId?: string;
  userId?: string;
  [key: string]: string | undefined;
}

/**
 * Generate a simple device identifier for token storage
 */
const getDeviceId = (): string => {
  // Use a simple ID based on platform and timestamp to avoid expo-device issues
  return `${Platform.OS}_${Date.now()}`;
};

const usePushNotifications = () => {
  const hasHandledInitialNotification = useRef(false);

  console.log('🔔 [PUSH] usePushNotifications hook MOUNTED');

  useEffect(() => {
    console.log('🔔 [PUSH] useEffect triggered - starting setup...');
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeOnNotificationOpened: (() => void) | null = null;
    let unsubscribeOnMessage: (() => void) | null = null;

    const setup = async () => {
      console.log('🔔 [PUSH] setup() called');
      try {
        // Handle notification that opened the app from quit state
        const handleInitialNotification = async () => {
          if (hasHandledInitialNotification.current) return;
          hasHandledInitialNotification.current = true;

          const remoteMessage = await messaging().getInitialNotification();
          if (remoteMessage?.data) {
            setTimeout(() => {
              handleNotificationNavigation(remoteMessage.data as NotificationData);
            }, 1000);
          }
        };

        // Handle notification when app is in background and user taps on notification
        unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(
          (remoteMessage) => {
            if (remoteMessage.data) {
              handleNotificationNavigation(remoteMessage.data as NotificationData);
            }
          }
        );

        // Handle notification when app is in foreground
        unsubscribeOnMessage = messaging().onMessage(
          async (remoteMessage) => {
            const title = remoteMessage.notification?.title || 'New Notification';
            const body = remoteMessage.notification?.body || '';

            Alert.alert(title, body, [
              { text: 'Dismiss', style: 'cancel' },
              {
                text: 'View',
                onPress: () => {
                  if (remoteMessage.data) {
                    handleNotificationNavigation(remoteMessage.data as NotificationData);
                  }
                },
              },
            ]);
          }
        );

        // Auth state listener
        unsubscribeAuth = auth().onAuthStateChanged((user) => {
          if (user) {
            setupMessaging(user);
            handleInitialNotification();
          }
        });
      } catch (error) {
        console.log('Push notification setup error:', error);
      }
    };

    const setupMessaging = async (user: any) => {
      try {
        console.log('🔔 [PUSH] Starting messaging setup for user:', user.uid);
        const authStatus = await messaging().requestPermission();
        console.log('🔔 [PUSH] Permission status:', authStatus);

        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('🔔 [PUSH] Notifications ENABLED, getting token...');
          getAndSaveToken(user);
          messaging().onTokenRefresh((token: string) => {
            console.log('🔔 [PUSH] Token refreshed!');
            getAndSaveToken(user, token);
          });
        } else {
          console.log('🔔 [PUSH] Notifications DENIED by user');
        }
      } catch (error: any) {
        console.log('🔔 [PUSH] Messaging setup ERROR:', error?.message || error);
      }
    };

    const getAndSaveToken = async (user: any, freshToken?: string) => {
      try {
        console.log('🔔 [PUSH] Getting FCM token...');
        const token = freshToken || await messaging().getToken();

        if (!token) {
          console.log('🔔 [PUSH] ERROR: Token is empty/null!');
          return;
        }

        console.log('🔔 [PUSH] FCM Token obtained:', token.substring(0, 30) + '...');
        console.log('🔔 [PUSH] Token length:', token.length);

        await saveTokenToFirestore(user, token);
        console.log('🔔 [PUSH] ✅ Token saved to Firestore for user:', user.uid);
      } catch (error: any) {
        console.log('🔔 [PUSH] Token get/save ERROR:', error?.message || error);
      }
    };

    const saveTokenToFirestore = async (user: any, token: string) => {
      try {
        const deviceId = getDeviceId();
        console.log('🔔 [PUSH] Saving token to Firestore...');
        console.log('🔔 [PUSH] Device ID:', deviceId);
        console.log('🔔 [PUSH] User ID:', user.uid);

        const tokenRef = firestore().collection('push_tokens').doc(user.uid);

        await tokenRef.set({
          tokens: {
            [deviceId]: {
              token,
              platform: Platform.OS,
              updatedAt: firestore.FieldValue.serverTimestamp(),
            }
          }
        }, { merge: true });

        console.log('🔔 [PUSH] ✅ Firestore write successful!');
      } catch (error: any) {
        console.log('🔔 [PUSH] ❌ Firestore save ERROR:', error?.code, error?.message);
      }
    };

    setup();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeOnNotificationOpened) unsubscribeOnNotificationOpened();
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, []);

  const handleNotificationNavigation = (data: NotificationData) => {
    const route = data.route;
    if (!route) return;

    try {
      switch (route) {
        case 'TripDetails':
          if (data.tripId) {
            RootNavigation.navigate('TripDetails', { tripId: data.tripId });
          }
          break;
        case 'Message':
          if (data.chatId) {
            RootNavigation.navigate('Message', { chatId: data.chatId });
          }
          break;
        case 'KYC':
          RootNavigation.navigate('KYC', {});
          break;
        case 'UserProfile':
        case 'Profile':
          if (data.userId) {
            RootNavigation.navigate('UserProfile', { userId: data.userId });
          }
          break;
        default:
          RootNavigation.navigate('App', {});
          break;
      }
    } catch (error) {
      // Navigation might not be ready
    }
  };
};

export default usePushNotifications;
