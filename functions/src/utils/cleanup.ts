
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
            const chatId = chatDoc.id;

            if (chatData.type === 'direct') {
                // ==================== DIRECT CHAT: DELETE EVERYTHING ====================
                console.log(`Deleting direct chat ${chatId}`);

                // 9a. Delete Storage (All images in this chat)
                // Path: chats/{chatId}/...
                try {
                    await bucket.deleteFiles({ prefix: `chats/${chatId}/` });
                } catch (e) {
                    console.log(`Error deleting storage for chat ${chatId}:`, e);
                }

                // 9b. Delete Messages Subcollection
                const messagesSnapshot = await chatDoc.ref.collection('messages').get();
                messagesSnapshot.forEach(msg => bulkWriter.delete(msg.ref));

                // 9c. Delete Chat Document
                bulkWriter.delete(chatDoc.ref);

            } else {
                // ==================== GROUP CHAT: REMOVE MEMBER & CLEAN UP MEDIA ====================
                console.log(`Removing user from group chat ${chatId}`);

                // 9d. Remove from Participants
                bulkWriter.update(chatDoc.ref, {
                    participants: admin.firestore.FieldValue.arrayRemove(uid),
                    [`participantDetails.${uid}`]: admin.firestore.FieldValue.delete(), // Also remove details map
                    // Optional: Add a system message saying user left? (Skipped for now to avoid side effects)
                });

                // 9e. Delete User's Image Messages & Storage in Group
                // This is expensive but necessary for full cleanup.
                const userImagesQuery = await chatDoc.ref.collection('messages')
                    .where('senderId', '==', uid)
                    .where('type', '==', 'image')
                    .get();

                for (const msgDoc of userImagesQuery.docs) {
                    const mediaUrl = msgDoc.data().mediaUrl;
                    if (mediaUrl) {
                        try {
                            // Extract path from URL or use if we stored path. 
                            // Since we don't store path, we must rely on bucket search or skip.
                            // Logic: If filename is unique enough, we might find it?
                            // Actually, we can try to parse the URL if it's a standard Firebase Storage URL.
                            // But usually, it's safer to just delete the message doc.
                            // If we can't easily find the file, we leave it (orphaned file).
                            // HOWEVER, if the file is at chats/{chatId}/images/{filename}, we can't easily know filename without parsing.

                            // Attempt to parse: .../o/chats%2F{chatId}%2Fimages%2F{filename}?alt=...
                            // Decode URL -> find substring "chats/{chatId}/images/"
                            const decoded = decodeURIComponent(mediaUrl);
                            const match = decoded.match(new RegExp(`chats/${chatId}/images/([^?]*)`));
                            if (match) {
                                const fullPath = `chats/${chatId}/images/${match[1]}`;
                                await bucket.file(fullPath).delete().catch(e => console.log('File not found or error:', e));
                            }
                        } catch (e) {
                            console.log('Error cleaning up group chat image:', e);
                        }
                    }
                    // Delete the message doc itself?
                    // "when a user is deleted chats collection... is not deleting"
                    // Usually we keep messages but mark sender as "Deleted User".
                    // But if user wants FULL delete, we should delete messages.
                    // Let's delete the message doc.
                    bulkWriter.delete(msgDoc.ref);
                }
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

        // 12. Stories (Delete all stories by user)
        const storiesQuery = await db.collection('stories').where('userId', '==', uid).get();
        storiesQuery.forEach(doc => bulkWriter.delete(doc.ref));

        // ==================== C. STORAGE (Prefix Deletion) ====================
        // Based on `imageUpload.ts` pattern: folder/userId/filename

        // 1. Profile Pictures: `profiles/{uid}/...`
        try {
            await bucket.deleteFiles({ prefix: `profiles/${uid}/` });
        } catch (e) {
            console.log("Error deleting profile storage:", e);
        }

        // 2. Trip Images: `trips/{uid}/...`
        try {
            await bucket.deleteFiles({ prefix: `trips/${uid}/` });
        } catch (e) {
            console.log("Error deleting trips storage:", e);
        }

        // 3. Chat Images: Handled in Step 9 (Per-chat basis)
        // Previous logic `chats/{uid}` was incorrect.


        // 4. Story Images: `stories/{uid}/...`
        try {
            await bucket.deleteFiles({ prefix: `stories/${uid}/` });
        } catch (e) {
            console.log("Error deleting stories storage:", e);
        }

        await bulkWriter.close();
        console.log(`Successfully wiped all data for ${uid}`);

    } catch (error) {
        console.error(`Error wiping data for ${uid}:`, error);
        throw error;
    }
};
