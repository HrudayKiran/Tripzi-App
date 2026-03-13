import { useEffect, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import fs, { getFirestore, collection, doc, setDoc, serverTimestamp, getDoc } from '@react-native-firebase/firestore';
import ms, { getMessaging, getToken, onMessage, onNotificationOpenedApp, getInitialNotification } from '@react-native-firebase/messaging';
import au, { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import * as RootNavigation from '../navigation/RootNavigation';
import { getNotificationPermissionStatus } from '../utils/notificationPermissions';
import { resolveNotificationTarget } from '../utils/notificationNavigation';

interface NotificationData {
  route?: string;
  tripId?: string;
  chatId?: string;
  userId?: string;
  url?: string;
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
              void handleNotificationNavigation(remoteMessage.data as NotificationData);
            }, 1000);
          }
        };

        // Handle notification when app is in background and user taps on notification
        unsubscribeOnNotificationOpened = onNotificationOpenedApp(messaging,
          (remoteMessage) => {
            if (remoteMessage.data) {
              void handleNotificationNavigation(remoteMessage.data as NotificationData);
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
            // System notification will show automatically due to setForegroundNotificationPresentationOptions
          }
        );

        // Auth state listener
        const auth = getAuth();
        unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
            void setupMessaging(user);
            handleInitialNotification();
          }
        });
      } catch (error) {

      }
    };

    const setupMessaging = async (user: any) => {
      try {
        const messaging = getMessaging();
        const permissionStatus = await getNotificationPermissionStatus();
        const db = getFirestore();
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data() || {};
        const notificationsEnabled =
          userData.pushNotificationsEnabled === true &&
          permissionStatus === 'granted';

        if (!notificationsEnabled) {
          return;
        }

        await getAndSaveToken(user);
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

  const handleNotificationNavigation = async (data: NotificationData) => {

    const route = data.route;
    if (!route) return;

    // Helper to navigate safely
    const navigate = (name: string, params?: any) => {
      try {
        RootNavigation.navigate(name, params);
      } catch (e) {

      }
    };

    const target = await resolveNotificationTarget({
      deepLinkRoute: route,
      deepLinkParams: {
        tripId: data.tripId,
        chatId: data.chatId,
        userId: data.userId,
        url: data.url,
      },
      entityId: data.tripId || data.chatId || data.userId || null,
      entityType: data.chatId ? 'chat' : data.tripId ? 'trip' : data.userId ? 'user' : null,
    });

    if (!target) {
      return;
    }

    if (target.route === 'ExternalLink') {
      const url = target.params?.url;
      if (typeof url === 'string' && url.length > 0) {
        Linking.openURL(url).catch(() => { });
      }
      return;
    }

    navigate(target.route, target.params || {});
  };
};

export default usePushNotifications;
