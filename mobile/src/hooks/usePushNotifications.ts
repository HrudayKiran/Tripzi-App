
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
        console.log("User is signed in, setting up push notifications.");
        setupMessaging(user);
      } else {
        // User is signed out
        console.log("User is signed out, skipping push notification setup.");
      }
    });

    const setupMessaging = async (user: User) => {
      // 1. Request Permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        // 2. Get Token and Save to Firestore
        getAndSaveToken(user);

        // 3. Listen for Token Refreshes
        messaging().onTokenRefresh((token) => getAndSaveToken(user, token));

        // 4. Listen for Foreground Messages
        messaging().onMessage(async remoteMessage => {
          console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
          // Here you could show a local notification
        });

      } else {
        console.log('Push notification permission denied');
      }
    };

    const getAndSaveToken = async (user: User, freshToken?: string) => {
        try {
            const token = freshToken || await messaging().getToken();
            console.log('FCM Token:', token);
            await saveTokenToFirestore(user, token);
        } catch (error) {
            console.error('Error getting or saving FCM token:', error);
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
            console.log('Push token saved to Firestore');
        } catch (error) {
            console.error('Error saving push token to Firestore:', error);
        }
    };

    // The returned function will be called on component unmount
    return unsubscribe;

  }, []); // Empty dependency array ensures this effect runs only once

};

export default usePushNotifications;
