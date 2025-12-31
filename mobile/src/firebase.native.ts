
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Android app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEU1lvIuQztqDB9-E4xthxrBh14XHEyAc",
  authDomain: "tripzi-52736816-98c83.firebaseapp.com",
  projectId: "tripzi-52736816-98c83",
  storageBucket: "tripzi-52736816-98c83.firebasestorage.app",
  messagingSenderId: "881054128450",
  appId: "1:881054128450:android:602f1b3b9c50acac2110db"
};

// Initialize Firebase
let app;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with React Native AsyncStorage persistence so
// auth state persists between app restarts.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Fallback to default auth if initializeAuth is unavailable
  // (shouldn't happen with modern Firebase versions).
  // eslint-disable-next-line global-require
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
