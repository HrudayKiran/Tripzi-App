import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import fs, { getFirestore, collection, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import ms, { getMessaging, getToken, onMessage, onNotificationOpenedApp, getInitialNotification, requestPermission, AuthorizationStatus } from '@react-native-firebase/messaging';
import au, { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
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
        const messaging = getMessaging(); // Modular instance

        // Handle notification that opened the app from quit state
        const handleInitialNotification = async () => {
          if (hasHandledInitialNotification.current) return;
          hasHandledInitialNotification.current = true;

          const remoteMessage = await getInitialNotification(messaging);
          if (remoteMessage?.data) {
            setTimeout(() => {
              handleNotificationNavigation(remoteMessage.data as NotificationData);
            }, 1000);
          }
        };

        // Handle notification when app is in background and user taps on notification
        unsubscribeOnNotificationOpened = onNotificationOpenedApp(messaging,
          (remoteMessage) => {
            if (remoteMessage.data) {
              handleNotificationNavigation(remoteMessage.data as NotificationData);
            }
          }
        );

        // Handle notification when app is in foreground
        unsubscribeOnMessage = onMessage(messaging,
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
        const auth = getAuth();
        unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
            setupMessaging(user);
            handleInitialNotification();
          }
        });
      } catch (error) {

      }
    };

    const setupMessaging = async (user: any) => {
      try {

        const messaging = getMessaging();
        const authStatus = await requestPermission(messaging);


        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        if (enabled) {

          getAndSaveToken(user);
          // Token refresh currently requires using instance method in some versions, 
          // or check documentation. safely sticking to getToken for now.
          // Note: onTokenRefresh might be deprecated or moved.
          // For simplicity, we just get the token once per session.
        } else {

        }
      } catch (error: any) {

      }
    };

    const getAndSaveToken = async (user: any, freshToken?: string) => {
      try {

        const messaging = getMessaging();
        const token = freshToken || await getToken(messaging);

        if (!token) {

          return;
        }



        await saveTokenToFirestore(user, token);

      } catch (error: any) {

      }
    };

    const saveTokenToFirestore = async (user: any, token: string) => {
      try {
        const deviceId = getDeviceId();


        const db = getFirestore();
        const tokenRef = doc(db, 'push_tokens', user.uid);

        await setDoc(tokenRef, {
          tokens: {
            [deviceId]: {
              token,
              platform: Platform.OS,
              updatedAt: serverTimestamp(),
            }
          }
        }, { merge: true });


      } catch (error: any) {

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
