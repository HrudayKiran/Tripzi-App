import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../utils/firebase";
import { createNotification, sendPushToUser } from "../utils/notifications";
import * as admin from "firebase-admin";

const buildPublicProfile = (userId: string, afterData: any) => {
  const resolvedName = afterData?.name || afterData?.displayName || "User";
  return {
    userId,
    displayName: resolvedName,
    username: afterData?.username || null,
    photoURL: afterData?.photoURL || null,
    bio: afterData?.bio || "",
    ageVerified: afterData?.ageVerified === true,
    totalRating: afterData?.totalRating || 0,
    ratingCount: afterData?.ratingCount || 0,
    createdAt: afterData?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

// ==================== USER NOTIFICATIONS + PUBLIC PROFILE SYNC ====================

/**
 * Keeps public profile in sync and handles user side effects.
 */
export const onUserUpdated = onDocumentWritten(
  { document: "users/{userId}" },
  async (event) => {
    if (!event.data) return;

    const beforeExists = event.data.before.exists;
    const afterExists = event.data.after.exists;
    const beforeData = beforeExists ? event.data.before.data() : null;
    const afterData = afterExists ? event.data.after.data() : null;
    const userId = event.params.userId;
    const updates: Promise<any>[] = [];

    // Handle deletes: remove public mirror.
    if (!afterExists || !afterData) {
      updates.push(db.collection("public_users").doc(userId).delete().catch(() => {}));
      await Promise.all(updates);
      return;
    }

    // Always sync public profile mirror.
    updates.push(
      db.collection("public_users").doc(userId).set(
        buildPublicProfile(userId, afterData),
        { merge: true }
      )
    );

    // Age verification success notification.
    const wasAgeVerified = beforeData?.ageVerified === true;
    const isAgeVerified = afterData?.ageVerified === true;
    if (!wasAgeVerified && isAgeVerified) {
      updates.push(createNotification({
        recipientId: userId,
        type: "kyc_verified",
        title: "Age Verified ✅",
        message: "You are now age verified! You can create and join trips.",
        entityId: userId,
        entityType: "user",
        deepLinkRoute: "Profile",
      }));

      updates.push(sendPushToUser(userId, {
        title: "Age Verified ✅",
        body: "You are now age verified! You can create and join trips.",
        data: { route: "Profile" },
      }));
    }

    // Keep owner summary denormalized on trips for feed/search performance.
    const profileChanged =
      !beforeData ||
      (beforeData.name || beforeData.displayName) !== (afterData.name || afterData.displayName) ||
      beforeData.photoURL !== afterData.photoURL ||
      beforeData.username !== afterData.username;

    if (profileChanged) {
      updates.push((async () => {
        const tripsSnapshot = await db.collection("trips").where("userId", "==", userId).get();
        if (tripsSnapshot.empty) return;

        const bulkWriter = db.bulkWriter();
        tripsSnapshot.forEach((tripDoc) => {
          bulkWriter.update(tripDoc.ref, {
            ownerDisplayName: afterData.name || afterData.displayName || null,
            ownerPhotoURL: afterData.photoURL || null,
            ownerUsername: afterData.username || null,
            ownerProfileUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await bulkWriter.close();
      })());
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
);
