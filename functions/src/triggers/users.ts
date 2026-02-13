
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== USER NOTIFICATIONS ====================

/**
 * Handle User Profile Updates (Age Verification, etc.)
 */
export const onUserUpdated = onDocumentUpdated(
    { document: "users/{userId}" },
    async (event) => {
        if (!event.data) return;

        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const userId = event.params.userId;

        // Check for Age Verification Success
        if (!beforeData.ageVerified && afterData.ageVerified) {
            await createNotification({
                recipientId: userId,
                type: "kyc_verified",
                title: "Age Verified ✅",
                message: "You are now age verified! You can create and join trips.",
                entityId: userId,
                entityType: "user",
                deepLinkRoute: "Profile",
            });

            await sendPushToUser(userId, {
                title: "Age Verified ✅",
                body: "You are now age verified! You can create and join trips.",
                data: { route: "Profile" },
            });
        }
    }
);
