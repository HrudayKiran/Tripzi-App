
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();
export const messaging = admin.messaging();
