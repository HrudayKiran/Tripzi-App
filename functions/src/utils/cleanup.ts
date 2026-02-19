import * as admin from 'firebase-admin';
import { db } from './firebase';

const safeDeleteStoragePrefix = async (bucket: any, prefix: string) => {
    try {
        await bucket.deleteFiles({ prefix });
    } catch (error) {
        console.log(`Storage delete skipped for prefix "${prefix}":`, error);
    }
};

const safeDeleteStorageUrl = async (bucket: any, url?: string) => {
    if (!url || typeof url !== 'string') return;

    try {
        const decodedUrl = decodeURIComponent(url);
        const match = decodedUrl.match(/\/o\/([^?]+)/);
        if (!match?.[1]) return;

        const path = match[1];
        await bucket.file(path).delete().catch(() => { });
    } catch (error) {
        console.log('Unable to delete storage by URL:', error);
    }
};

const deleteSubcollectionDocs = async (
    collectionRef: any,
    bulkWriter: any
) => {
    const snapshot = await collectionRef.get();
    snapshot.forEach((doc: any) => bulkWriter.delete(doc.ref));
};

/**
 * Completely wipes a user's data from Firestore and Storage.
 * Designed to be called by Auth triggers or callable account deletion.
 */
export const wipeUserData = async (uid: string) => {
    console.log(`Starting comprehensive wipe for user: ${uid}`);

    const bulkWriter = db.bulkWriter();
    const bucket = admin.storage().bucket();

    try {
        // ==================== A. OWNED ROOT DOCS ====================

        const userRef = db.collection('users').doc(uid);
        bulkWriter.delete(userRef);

        // Notifications now live at notifications/{uid}/items/*
        const notificationsRootRef = db.collection('notifications').doc(uid);
        await deleteSubcollectionDocs(notificationsRootRef.collection('items'), bulkWriter);
        bulkWriter.delete(notificationsRootRef);

        bulkWriter.delete(db.collection('push_tokens').doc(uid));

        // ==================== B. OWNED COLLECTION DATA ====================

        const ownedTripsSnapshot = await db.collection('trips').where('userId', '==', uid).get();
        const ownedTripIds = new Set<string>();
        ownedTripsSnapshot.forEach((tripDoc) => {
            ownedTripIds.add(tripDoc.id);
            bulkWriter.delete(tripDoc.ref);
        });

        const ratingDeletePaths = new Set<string>();
        const ratingsByUserSnapshot = await db.collection('ratings').where('userId', '==', uid).get();
        ratingsByUserSnapshot.forEach((doc) => {
            if (ratingDeletePaths.has(doc.ref.path)) return;
            ratingDeletePaths.add(doc.ref.path);
            bulkWriter.delete(doc.ref);
        });

        const ratingsForHostSnapshot = await db.collection('ratings').where('hostId', '==', uid).get();
        ratingsForHostSnapshot.forEach((doc) => {
            if (ratingDeletePaths.has(doc.ref.path)) return;
            ratingDeletePaths.add(doc.ref.path);
            bulkWriter.delete(doc.ref);
        });

        const reportsByUserSnapshot = await db.collection('reports').where('reporterId', '==', uid).get();
        const ownedReportIds: string[] = [];
        reportsByUserSnapshot.forEach((doc) => {
            ownedReportIds.push(doc.id);
            bulkWriter.delete(doc.ref);
        });

        const feedbackCollections: Array<{ name: string; ownerField: string }> = [
            { name: 'suggestions', ownerField: 'userId' },
            { name: 'bugs', ownerField: 'userId' },
            { name: 'feature_requests', ownerField: 'userId' },
        ];

        for (const feedback of feedbackCollections) {
            const snapshot = await db.collection(feedback.name).where(feedback.ownerField, '==', uid).get();
            snapshot.forEach((doc) => bulkWriter.delete(doc.ref));
        }

        // ==================== C. SHARED DATA REFERENCES ====================

        const joinedTripsSnapshot = await db.collection('trips').where('participants', 'array-contains', uid).get();
        joinedTripsSnapshot.forEach((tripDoc) => {
            if (tripDoc.data().userId === uid || ownedTripIds.has(tripDoc.id)) return;
            bulkWriter.update(tripDoc.ref, {
                participants: admin.firestore.FieldValue.arrayRemove(uid),
            });
        });

        const likedTripsSnapshot = await db.collection('trips').where('likes', 'array-contains', uid).get();
        likedTripsSnapshot.forEach((tripDoc) => {
            bulkWriter.update(tripDoc.ref, {
                likes: admin.firestore.FieldValue.arrayRemove(uid),
            });
        });

        const followerSnapshot = await db.collection('users').where('followers', 'array-contains', uid).get();
        followerSnapshot.forEach((doc) => {
            bulkWriter.update(doc.ref, {
                followers: admin.firestore.FieldValue.arrayRemove(uid),
            });
        });

        const followingSnapshot = await db.collection('users').where('following', 'array-contains', uid).get();
        followingSnapshot.forEach((doc) => {
            bulkWriter.update(doc.ref, {
                following: admin.firestore.FieldValue.arrayRemove(uid),
            });
        });

        // ==================== D. CHATS ====================

        const chatsSnapshot = await db.collection('chats').where('participants', 'array-contains', uid).get();
        for (const chatDoc of chatsSnapshot.docs) {
            const chatData = chatDoc.data();
            const chatId = chatDoc.id;

            if (chatData.type === 'direct') {
                await safeDeleteStoragePrefix(bucket, `chats/${chatId}/`);
                await deleteSubcollectionDocs(chatDoc.ref.collection('messages'), bulkWriter);
                await deleteSubcollectionDocs(chatDoc.ref.collection('live_shares'), bulkWriter);
                bulkWriter.delete(chatDoc.ref);
                continue;
            }

            bulkWriter.update(chatDoc.ref, {
                participants: admin.firestore.FieldValue.arrayRemove(uid),
                admins: admin.firestore.FieldValue.arrayRemove(uid),
                deletedBy: admin.firestore.FieldValue.arrayRemove(uid),
                [`participantDetails.${uid}`]: admin.firestore.FieldValue.delete(),
                [`unreadCount.${uid}`]: admin.firestore.FieldValue.delete(),
                [`clearedAt.${uid}`]: admin.firestore.FieldValue.delete(),
            });

            // Full delete policy for account wipe: remove authored messages.
            const authoredMessages = await chatDoc.ref.collection('messages').where('senderId', '==', uid).get();
            for (const messageDoc of authoredMessages.docs) {
                const mediaUrl = messageDoc.data()?.mediaUrl;
                if (mediaUrl) {
                    await safeDeleteStorageUrl(bucket, mediaUrl);
                }
                bulkWriter.delete(messageDoc.ref);
            }
        }

        // ==================== E. STORAGE PREFIXES ====================

        await safeDeleteStoragePrefix(bucket, `profiles/${uid}/`);
        await safeDeleteStoragePrefix(bucket, `trips/${uid}/`);
        await safeDeleteStoragePrefix(bucket, `groups/${uid}/`);
        await safeDeleteStoragePrefix(bucket, `feedback/${uid}/`);

        for (const reportId of ownedReportIds) {
            await safeDeleteStoragePrefix(bucket, `reports/${reportId}/`);
        }

        await bulkWriter.close();
        console.log(`Successfully wiped all data for ${uid}`);
    } catch (error) {
        console.error(`Error wiping data for ${uid}:`, error);
        throw error;
    }
};
