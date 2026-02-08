
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== USER NOTIFICATIONS ====================

/**
 * Handle User Profile Updates (Follows, Age Verification, etc.)
 */
export const onUserUpdated = onDocumentUpdated(
    { document: "users/{userId}" },
    async (event) => {
        if (!event.data) return;

        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const userId = event.params.userId;

        // 1. Check for New Followers
        const beforeFollowers = beforeData.followers || [];
        const afterFollowers = afterData.followers || [];

        console.log(`User update: ${userId}, followers: ${beforeFollowers.length} -> ${afterFollowers.length}`);

        if (afterFollowers.length > beforeFollowers.length) {
            const newFollowerId = afterFollowers.find((uid: string) => !beforeFollowers.includes(uid));
            console.log(`New follower detected: ${newFollowerId}`);

            if (newFollowerId) {
                const followerDoc = await db.collection("users").doc(newFollowerId).get();
                const followerName = followerDoc.data()?.displayName || "Someone";

                await createNotification({
                    recipientId: userId,
                    type: "follow",
                    title: "New Follower 👤",
                    message: `${followerName} started following you`,
                    entityId: newFollowerId,
                    entityType: "user",
                    actorId: newFollowerId,
                    actorName: followerName,
                    deepLinkRoute: "UserProfile",
                    deepLinkParams: { userId: newFollowerId },
                });
                console.log(`Notification created for ${userId}`);

                await sendPushToUser(userId, {
                    title: "New Follower 👤",
                    body: `${followerName} started following you`,
                    data: { route: "UserProfile", userId: newFollowerId },
                });
            }
        }

        // 2. Check for Age Verification Success
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
