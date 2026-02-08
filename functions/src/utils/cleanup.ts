
import * as admin from 'firebase-admin';
import { db } from './firebase';

/**
 * Completely wipes a user's data from Firestore and Storage.
 * Designed to be called by Auth Triggers or Admin functions.
 * 
 * STRATEGY: "User Isolation"
 * - All Storage is deleted via user-specific prefixes: `profiles/{uid}`, `trips/{uid}`, `chats/{uid}`.
 * - All Firestore data is identified via `userId` queries.
 * - Shared data (Participants, Likes) is cleaned via array ref removal.
 */
export const wipeUserData = async (uid: string) => {
    console.log(`Starting comprehensive wipe for user: ${uid}`);
    const bulkWriter = db.bulkWriter();
    const storage = admin.storage();
    const bucket = storage.bucket();

    try {
        // ==================== A. OWNED DATA (Direct Deletion) ====================

        // 1. User Profile & Notifications
        // Deletes `users/{uid}` and subcollections like `notifications`
        const userRef = db.collection('users').doc(uid);
        // Note: bulkWriter.delete ignores subcollections. We must list them.
        const notifsSnapshot = await userRef.collection('items').get();
        notifsSnapshot.forEach(doc => bulkWriter.delete(doc.ref));
        bulkWriter.delete(userRef);

        // 2. Push Tokens
        bulkWriter.delete(db.collection('push_tokens').doc(uid));

        // 3. Owned Trips
        const ownedTripsQuery = await db.collection('trips').where('userId', '==', uid).get();
        for (const tripDoc of ownedTripsQuery.docs) {
            bulkWriter.delete(tripDoc.ref);
            // Note: Storage for these trips is deleted in bulk below (C.2)
        }

        // 4. Ratings (Given by user)
        const ratingsQuery = await db.collection('ratings').where('raterId', '==', uid).get();
        ratingsQuery.forEach(doc => bulkWriter.delete(doc.ref));

        // 5. Reports (Submitted by user)
        const reportsQuery = await db.collection('reports').where('reporterId', '==', uid).get();
        reportsQuery.forEach(doc => bulkWriter.delete(doc.ref));

        // 6. Comments (Collection Group Query)
        // Deleting all comments made by user across all trips
        const commentsQuery = await db.collectionGroup('comments').where('userId', '==', uid).get();
        commentsQuery.forEach(doc => bulkWriter.delete(doc.ref));


        // ==================== B. SHARED DATA (Array Removal) ====================

        // 7. Joined Trips (Remove from participants)
        const joinedTripsQuery = await db.collection('trips').where('participants', 'array-contains', uid).get();
        joinedTripsQuery.forEach(doc => {
            // Only update if not already being deleted (owned trips are handled above)
            if (doc.data().userId !== uid) {
                bulkWriter.update(doc.ref, {
                    participants: admin.firestore.FieldValue.arrayRemove(uid)
                });
            }
        });

        // 8. Liked Trips (Remove from likes)
        const likedTripsQuery = await db.collection('trips').where('likes', 'array-contains', uid).get();
        likedTripsQuery.forEach(doc => {
            bulkWriter.update(doc.ref, {
                likes: admin.firestore.FieldValue.arrayRemove(uid)
            });
        });

        // 9. Chats
        const chatsQuery = await db.collection('chats').where('participants', 'array-contains', uid).get();
        for (const chatDoc of chatsQuery.docs) {
            const chatData = chatDoc.data();
            if (chatData.type === 'direct') {
                // Delete DM entirely
                // 9a. Delete messages subcollection
                const messagesSnapshot = await chatDoc.ref.collection('messages').get();
                messagesSnapshot.forEach(msg => bulkWriter.delete(msg.ref));
                // 9b. Delete chat doc
                bulkWriter.delete(chatDoc.ref);
            } else {
                // Remove from Group
                bulkWriter.update(chatDoc.ref, {
                    participants: admin.firestore.FieldValue.arrayRemove(uid)
                });
            }
        }

        // 10. Followers (Remove user from other users' followers list)
        const followersQuery = await db.collection('users').where('followers', 'array-contains', uid).get();
        followersQuery.forEach(doc => {
            bulkWriter.update(doc.ref, {
                followers: admin.firestore.FieldValue.arrayRemove(uid)
            });
        });

        // 11. Following (Remove user from other users' following list)
        const followingQuery = await db.collection('users').where('following', 'array-contains', uid).get();
        followingQuery.forEach(doc => {
            bulkWriter.update(doc.ref, {
                following: admin.firestore.FieldValue.arrayRemove(uid)
            });
        });

        // ==================== C. STORAGE (Prefix Deletion) ====================
        // Based on `imageUpload.ts` pattern: folder/userId/filename

        // 1. Profile Pictures: `profiles/{uid}/...`
        try {
            await bucket.deleteFiles({ prefix: `profiles/${uid}/` });
        } catch (e) {
            console.log("Error deleting profile storage:", e);
        }

        // 2. Trip Images: `trips/{uid}/...`
        // This effectively separates user's trip storage. All images for all their trips live here.
        try {
            await bucket.deleteFiles({ prefix: `trips/${uid}/` });
        } catch (e) {
            console.log("Error deleting trips storage:", e);
        }

        // 3. Chat Images: `chats/{uid}/...`
        try {
            await bucket.deleteFiles({ prefix: `chats/${uid}/` });
        } catch (e) {
            console.log("Error deleting chats storage:", e);
        }

        await bulkWriter.close();
        console.log(`Successfully wiped all data for ${uid}`);

    } catch (error) {
        console.error(`Error wiping data for ${uid}:`, error);
        throw error;
    }
};
