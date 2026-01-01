/**
 * Firebase Native Configuration
 * 
 * NOTE: This file uses the Firebase JS SDK for web compatibility.
 * For React Native, you should primarily use @react-native-firebase packages
 * which are already configured in your app.
 * 
 * The @react-native-firebase packages (auth, firestore, storage, etc.)
 * read configuration from google-services.json automatically.
 */

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';

// Firebase project configuration
// This is for the JS SDK - @react-native-firebase uses google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyAT8YWdG94YSiMORTWf1NiNQRNDtJ9FW6w",
  authDomain: "tripzi-app.firebaseapp.com",
  projectId: "tripzi-app",
  storageBucket: "tripzi-app.firebasestorage.app",
  messagingSenderId: "334857280812",
  appId: "1:334857280812:android:a2948142078ba52a4fa089"
};

// Initialize Firebase (only if using JS SDK alongside react-native-firebase)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase JS SDK initialization failed:', error);
  // This is expected if only using @react-native-firebase
}

export { app, auth, db, storage };
