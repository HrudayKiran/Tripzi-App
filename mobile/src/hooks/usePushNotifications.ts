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

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeOnNotificationOpened: (() => void) | null = null;
    let unsubscribeOnMessage: (() => void) | null = null;

    const setup = async () => {
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
        // Silent fail - push notifications are optional
      }
    };

    const setupMessaging = async (user: any) => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          getAndSaveToken(user);
          messaging().onTokenRefresh((token: string) => getAndSaveToken(user, token));
        }
      } catch (error) {
        // Silent fail
      }
    };

    const getAndSaveToken = async (user: any, freshToken?: string) => {
      try {
        const token = freshToken || await messaging().getToken();
        await saveTokenToFirestore(user, token);
      } catch (error) {
        // Silent fail
      }
    };

    const saveTokenToFirestore = async (user: any, token: string) => {
      try {
        const deviceId = getDeviceId();
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
      } catch (error) {
        // Silent fail
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
        case 'KycScreen':
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
