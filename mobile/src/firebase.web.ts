import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration (same as native)
const firebaseConfig = {
  apiKey: "AIzaSyAqVCpvc-auL_AQsIQ8FRrMyHg3fuYiFhk",
  authDomain: "tripzi-52736816-98c83.firebaseapp.com",
  projectId: "tripzi-52736816-98c83",
  storageBucket: "tripzi-52736816-98c83.appspot.com",
  messagingSenderId: "881054128450",
  appId: "1:881054128450:web:a7645cdd7259bc6c2110db"
};

let app;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
