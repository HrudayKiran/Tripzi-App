
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

const usePushNotifications = () => {
  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/firebase.User

        setupMessaging(user);
      } else {
        // User is signed out

      }
    });

    const setupMessaging = async (user: User) => {
      // 1. Request Permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {

        // 2. Get Token and Save to Firestore
        getAndSaveToken(user);

        // 3. Listen for Token Refreshes
        messaging().onTokenRefresh((token: string) => getAndSaveToken(user, token));

        // 4. Listen for Foreground Messages
        messaging().onMessage(async (remoteMessage: unknown) => {
          // Here you could show a local notification
        });

      } else {

      }
    };

    const getAndSaveToken = async (user: User, freshToken?: string) => {
        try {
        const token = freshToken || await messaging().getToken();

            await saveTokenToFirestore(user, token);
        } catch (error) {

        }
    };

    const saveTokenToFirestore = async (user: User, token: string) => {
        try {
            const tokenRef = doc(collection(db, 'push_tokens'), user.uid);
            await setDoc(tokenRef, {
                token,
                platform: Platform.OS,
                updated_at: new Date().toISOString(),
            }, { merge: true }); // Using merge to upsert

        } catch (error) {

        }
    };

    // The returned function will be called on component unmount
    return unsubscribe;

  }, []); // Empty dependency array ensures this effect runs only once

};

export default usePushNotifications;
