import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import fs, { getFirestore, collection, doc, setDoc, serverTimestamp, getDoc } from '@react-native-firebase/firestore';
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

        // Enable foreground notification presentation options
        await messaging.setForegroundNotificationPresentationOptions({
          alert: true,
          badge: true,
          sound: true,
        });

        // Handle notification when app is in foreground - Just log it now, system handles UI
        unsubscribeOnMessage = onMessage(messaging,
          async (remoteMessage) => {
            console.log('[PUSH] Foreground notification received:', remoteMessage.notification?.title);
            // System notification will show automatically due to setForegroundNotificationPresentationOptions
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
        console.log('[PUSH] getAndSaveToken called for user:', user.uid);
        const messaging = getMessaging();
        const token = freshToken || await getToken(messaging);

        if (!token) {
          console.log('[PUSH] No token received from FCM');
          return;
        }

        console.log('[PUSH] Token received:', token.substring(0, 20) + '...');

        await saveTokenToFirestore(user, token);

      } catch (error: any) {
        console.error('[PUSH] Error getting token:', error.message);
      }
    };

    const saveTokenToFirestore = async (user: any, token: string) => {
      try {
        const db = getFirestore();
        const tokenRef = doc(db, 'push_tokens', user.uid);
        const tokenDoc = await getDoc(tokenRef);

        let deviceId = getDeviceId(); // Default new ID
        let tokensMap: any = {};

        if (tokenDoc.exists()) {
          const data = tokenDoc.data();
          tokensMap = data?.tokens || {};

          // Check if this token already exists
          const existingDeviceId = Object.keys(tokensMap).find(
            key => tokensMap[key]?.token === token
          );

          if (existingDeviceId) {
            console.log('[PUSH] Token already exists for device:', existingDeviceId);
            deviceId = existingDeviceId; // Reuse the existing key
          }
        }

        // Update or Set the token entry
        await setDoc(tokenRef, {
          tokens: {
            [deviceId]: {
              token,
              platform: Platform.OS,
              updatedAt: serverTimestamp(),
            }
          }
        }, { merge: true });

        console.log('[PUSH] Token saved/updated successfully for', deviceId);
      } catch (error: any) {
        console.error('[PUSH] Error saving token:', error.message);
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
    console.log('[PUSH] Handling notification navigation:', data);
    const route = data.route;
    if (!route) return;

    // Helper to navigate safely
    const navigate = (name: string, params?: any) => {
      try {
        RootNavigation.navigate(name, params);
      } catch (e) {
        console.error('[PUSH] Navigation failed:', e);
      }
    };

    switch (route) {
      case 'TripDetails':
        if (data.tripId) {
          navigate('TripDetails', { tripId: data.tripId });
        }
        break;
      case 'Chat':
      case 'Message':
        if (data.chatId) {
          navigate('Chat', { chatId: data.chatId }); // Verify if screen name is 'Chat' or 'Message'
        }
        break;
      case 'UserProfile':
      case 'Profile':
        if (data.userId) {
          navigate('UserProfile', { userId: data.userId });
        } else {
          navigate('UserProfile', {}); // Go to own profile
        }
        break;
      case 'AdminDashboard':
        navigate('AdminDashboard');
        break;
      default:
        console.log('[PUSH] Unknown route:', route);
        break;
    }
  };
};

export default usePushNotifications;
