
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification } from '../utils/notifications';

// ==================== SYSTEM NOTIFICATIONS ====================

/**
 * Notify ALL users when a new App Version is released.
 * Listens to: config/version
 */
export const onAppVersionUpdated = onDocumentUpdated(
    { document: "config/version" },
    async (event) => {
        if (!event.data) return;

        const afterData = event.data.after.data();
        const newVersion = afterData.latestVersion;
        const releaseNotes = afterData.releaseNotes || "New features available!";

        if (newVersion) {
            // WARNING: Broadcasting to ALL users is expensive and slow for large user bases.
            // For v1.0.0 (small scale), we can iterate 'users' collection.
            // For scale, use FCM Topics ('all_users').

            // 1. Send Topic Message (Best Practice for Mass Push)
            /*
            await messaging.send({
                topic: 'all_users',
                notification: { title: 'Update Available! 🚀', body: `Tripzi ${newVersion} is here.` }
            });
            */

            // 2. In-App Notifications (Iterating users - simple for now)
            const usersSnapshot = await db.collection('users').get();

            const batchPromises = usersSnapshot.docs.map(async (userDoc) => {
                const userId = userDoc.id;
                await createNotification({
                    recipientId: userId,
                    type: "system",
                    title: "Update Available 🚀",
                    message: `Tripzi ${newVersion} is available: ${releaseNotes}`,
                    deepLinkRoute: "ExternalLink",
                    deepLinkParams: { url: afterData.storeUrl || "https://play.google.com/store/apps/details?id=com.tripzi.mobile" },
                });
            });

            await Promise.all(batchPromises);
        }
    }
);
