import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize Firebase Admin with explicit project settings
const app = admin.initializeApp({
  projectId: "tripzi-app",
});

// Use the default database
const db = admin.firestore(app);
db.settings({
  ignoreUndefinedProperties: true,
});


// ==================== HELPER FUNCTIONS ====================

interface PushPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

/**
 * Send push notification to a user via FCM.
 * Handles multiple devices per user and cleans up invalid tokens.
 */
async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const tokenDoc = await db.collection("push_tokens").doc(userId).get();
    if (!tokenDoc.exists) {
      console.log(`No push tokens found for user ${userId}`);
      return;
    }

    const tokenData = tokenDoc.data();
    if (!tokenData?.tokens) return;

    const tokens: string[] = Object.values(tokenData.tokens)
      .map((t: any) => t.token)
      .filter(Boolean);

    if (tokens.length === 0) {
      console.log(`No valid tokens for user ${userId}`);
      return;
    }

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Push sent to ${userId}: ${response.successCount} success, ${response.failureCount} failures`);

    // Clean up invalid tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (errorCode === "messaging/unregistered" ||
          errorCode === "messaging/invalid-registration-token") {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      const updates: { [key: string]: admin.firestore.FieldValue } = {};
      for (const [deviceId, tokenInfo] of Object.entries(tokenData.tokens)) {
        if (tokensToRemove.includes((tokenInfo as any).token)) {
          updates[`tokens.${deviceId}`] = admin.firestore.FieldValue.delete();
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.collection("push_tokens").doc(userId).update(updates);
        console.log(`Removed ${tokensToRemove.length} invalid tokens for user ${userId}`);
      }
    }
  } catch (error) {
    console.error(`Error sending push to user ${userId}:`, error);
  }
}

/**
 * Create an in-app notification document.
 */
async function createNotification(data: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  actorId?: string;
  actorName?: string;
  actorPhotoUrl?: string;
  deepLinkRoute: string;
  deepLinkParams?: { [key: string]: any };
}): Promise<void> {
  await db.collection("notifications").add({
    recipientId: data.recipientId,
    type: data.type,
    title: data.title,
    message: data.message,
    entityId: data.entityId || null,
    entityType: data.entityType || null,
    actorId: data.actorId || null,
    actorName: data.actorName || null,
    actorPhotoUrl: data.actorPhotoUrl || null,
    deepLinkRoute: data.deepLinkRoute,
    deepLinkParams: data.deepLinkParams || {},
    read: false,
    readAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ==================== TRIP FUNCTIONS ====================

/**
 * Create group chat when trip reaches max travelers.
 */
export const createGroupChatOnTripFull = onDocumentUpdated(
  { document: "trips/{tripId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const tripData = event.data.after.data();
    const tripId = event.params.tripId;

    if (
      tripData.participants &&
      tripData.maxTravelers &&
      tripData.participants.length === tripData.maxTravelers
    ) {
      const chatRoomId = `trip_${tripId}`;
      const chatRoomRef = db.collection("chats").doc(chatRoomId);
      const chatRoomSnap = await chatRoomRef.get();

      if (!chatRoomSnap.exists) {
        await chatRoomRef.set({
          participants: tripData.participants,
          tripId: tripId,
          isGroupChat: true,
          groupName: tripData.title,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Group chat created for trip ${tripId}`);

        // Notify all participants
        for (const userId of tripData.participants) {
          await createNotification({
            recipientId: userId,
            type: "trip_full",
            title: "Trip is Full! 🎉",
            message: `The trip "${tripData.title}" is now full. A group chat has been created!`,
            entityId: tripId,
            entityType: "trip",
            deepLinkRoute: "Message",
            deepLinkParams: { chatId: chatRoomId },
          });

          await sendPushToUser(userId, {
            title: "Trip is Full! 🎉",
            body: `The trip "${tripData.title}" is now full. Check the group chat!`,
            data: { route: "Message", chatId: chatRoomId },
          });
        }
      }
    }
  });

// ==================== LIKE NOTIFICATIONS ====================

/**
 * Send notification when someone likes a trip/post.
 */
export const onLikeCreated = onDocumentCreated(
  { document: "likes/{likeId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const like = event.data.data();
    if (!like.tripId || !like.userId) return;

    const tripDoc = await db.collection("trips").doc(like.tripId).get();
    if (!tripDoc.exists) return;

    const trip = tripDoc.data()!;

    // Don't notify if user likes their own post
    if (trip.userId === like.userId) return;

    const likerDoc = await db.collection("users").doc(like.userId).get();
    const liker = likerDoc.data() || {};

    await createNotification({
      recipientId: trip.userId,
      type: "like",
      title: "New Like! ❤️",
      message: `${liker.displayName || "Someone"} liked your trip to ${trip.destination}`,
      entityId: like.tripId,
      entityType: "trip",
      actorId: like.userId,
      actorName: liker.displayName,
      actorPhotoUrl: liker.photoURL,
      deepLinkRoute: "TripDetails",
      deepLinkParams: { tripId: like.tripId },
    });

    await sendPushToUser(trip.userId, {
      title: "New Like! ❤️",
      body: `${liker.displayName || "Someone"} liked your trip to ${trip.destination}`,
      data: { route: "TripDetails", tripId: like.tripId },
    });
  });

// ==================== COMMENT NOTIFICATIONS ====================

/**
 * Send notification when someone comments on a trip/post.
 */
export const onCommentCreated = onDocumentCreated(
  { document: "comments/{commentId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const comment = event.data.data();
    if (!comment.tripId || !comment.userId) return;

    const tripDoc = await db.collection("trips").doc(comment.tripId).get();
    if (!tripDoc.exists) return;

    const trip = tripDoc.data()!;

    // Don't notify if user comments on their own post
    if (trip.userId === comment.userId) return;

    const commenterDoc = await db.collection("users").doc(comment.userId).get();
    const commenter = commenterDoc.data() || {};

    const truncatedText = comment.text?.substring(0, 50) || "";
    const displayText = truncatedText.length < comment.text?.length ?
      `${truncatedText}...` :
      truncatedText;

    await createNotification({
      recipientId: trip.userId,
      type: "comment",
      title: "New Comment 💬",
      message: `${commenter.displayName || "Someone"}: "${displayText}"`,
      entityId: comment.tripId,
      entityType: "trip",
      actorId: comment.userId,
      actorName: commenter.displayName,
      actorPhotoUrl: commenter.photoURL,
      deepLinkRoute: "TripDetails",
      deepLinkParams: { tripId: comment.tripId },
    });

    await sendPushToUser(trip.userId, {
      title: "New Comment 💬",
      body: `${commenter.displayName || "Someone"}: "${displayText}"`,
      data: { route: "TripDetails", tripId: comment.tripId },
    });
  });

// ==================== MESSAGE NOTIFICATIONS ====================

/**
 * Send notification when a new message is received.
 */
export const onMessageCreated = onDocumentCreated(
  { document: "chats/{chatId}/messages/{messageId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const message = event.data.data();
    const chatId = event.params.chatId;

    if (!message.senderId) return;

    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) return;

    const chat = chatDoc.data()!;
    const recipients = (chat.participants || []).filter(
      (uid: string) => uid !== message.senderId
    );

    if (recipients.length === 0) return;

    const senderDoc = await db.collection("users").doc(message.senderId).get();
    const sender = senderDoc.data() || {};

    // For direct chats, show sender name; for groups, show group name
    const displayName = chat.type === 'group' ?
      chat.groupName :
      sender.displayName || "Someone";

    const messagePreview = message.text?.substring(0, 50) || "Sent an image";

    // Increment unread counts for recipients
    const unreadUpdates: { [key: string]: admin.firestore.FieldValue } = {};
    for (const recipientId of recipients) {
      unreadUpdates[`unreadCount.${recipientId}`] = admin.firestore.FieldValue.increment(1);
    }
    await db.collection("chats").doc(chatId).update(unreadUpdates);

    for (const recipientId of recipients) {
      // Create in-app notification
      await createNotification({
        recipientId,
        type: "message",
        title: displayName,
        message: messagePreview,
        entityId: chatId,
        entityType: "chat",
        actorId: message.senderId,
        actorName: sender.displayName,
        actorPhotoUrl: sender.photoURL,
        deepLinkRoute: "Chat",
        deepLinkParams: { chatId },
      });

      // Send push notification
      await sendPushToUser(recipientId, {
        title: displayName,
        body: messagePreview,
        data: { route: "Chat", chatId },
      });
    }
  });


// ==================== KYC NOTIFICATIONS ====================

/**
 * Send notification when KYC status changes (approved/rejected).
 */
export const onKycUpdated = onDocumentUpdated(
  { document: "kyc/{kycId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only trigger if status changed
    if (before.status === after.status) return;

    const isApproved = after.status === "approved";
    const isRejected = after.status === "rejected";

    if (!isApproved && !isRejected) return;

    // Update user's kycStatus
    await db.collection("users").doc(after.userId).update({
      kycStatus: after.status,
    });

    // Create notification
    await createNotification({
      recipientId: after.userId,
      type: isApproved ? "kyc_approved" : "kyc_rejected",
      title: isApproved ? "KYC Approved! 🎉" : "KYC Update",
      message: isApproved ?
        "Congrats, your KYC is successfully verified. Start posting or join trips!" :
        `Your KYC was rejected: ${after.rejectionReason || "Please resubmit with valid documents."}`,
      entityId: undefined,
      entityType: "kyc",
      deepLinkRoute: isApproved ? "Feed" : "KycScreen",
      deepLinkParams: {},
    });

    // Send push notification
    await sendPushToUser(after.userId, {
      title: isApproved ? "KYC Approved! 🎉" : "KYC Update",
      body: isApproved ?
        "Congrats, your KYC is successfully verified. Start posting or join trips!" :
        "Your KYC application needs attention.",
      data: { route: isApproved ? "Feed" : "KycScreen" },
    });
  });

// ==================== TRIP JOIN NOTIFICATIONS ====================

/**
 * Send notification when someone joins a trip.
 */
export const onTripJoin = onDocumentUpdated(
  { document: "trips/{tripId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const tripId = event.params.tripId;

    const beforeParticipants = before.participants || [];
    const afterParticipants = after.participants || [];

    // Check if a new participant was added
    const newParticipants = afterParticipants.filter(
      (uid: string) => !beforeParticipants.includes(uid)
    );

    if (newParticipants.length === 0) return;

    for (const newUserId of newParticipants) {
      // Don't notify the trip owner if they're "joining" their own trip
      if (newUserId === after.userId) continue;

      const joinerDoc = await db.collection("users").doc(newUserId).get();
      const joiner = joinerDoc.data() || {};

      // Notify trip owner
      await createNotification({
        recipientId: after.userId,
        type: "trip_join",
        title: "New Trip Member! 🎒",
        message: `${joiner.displayName || "Someone"} joined your trip to ${after.destination}`,
        entityId: tripId,
        entityType: "trip",
        actorId: newUserId,
        actorName: joiner.displayName,
        actorPhotoUrl: joiner.photoURL,
        deepLinkRoute: "TripDetails",
        deepLinkParams: { tripId },
      });

      await sendPushToUser(after.userId, {
        title: "New Trip Member! 🎒",
        body: `${joiner.displayName || "Someone"} joined your trip to ${after.destination}`,
        data: { route: "TripDetails", tripId },
      });
    }
  });

// ==================== NEW USER WELCOME NOTIFICATION ====================

/**
 * Create welcome/KYC reminder notification for new users.
 */
export const onUserCreated = onDocumentCreated(
  { document: "users/{userId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const userId = event.params.userId;

    // Create actionable notification for KYC verification
    await createNotification({
      recipientId: userId,
      type: "action_required",
      title: "Welcome to Tripzi! 🌍",
      message: "Want to post or join a trip? Please verify your KYC to get started.",
      entityId: undefined,
      entityType: undefined,
      deepLinkRoute: "KycScreen",
      deepLinkParams: {},
    });
  });

import * as functions from "firebase-functions/v1";

// ==================== AUTH TRIGGERS (v1) ====================

/**
 * Automatically create user document in Firestore when a new user is created in Auth.
 * This handles both app sign-ups and manual console creation.
 */
export const createProfileOnAuth = functions.auth.user().onCreate(async (user: functions.auth.UserRecord) => {
  if (!user) return;

  const userRef = db.collection("users").doc(user.uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    await userRef.set({
      userId: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || null,
      emailVerified: user.emailVerified || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      followers: [],
      following: [],
      kycStatus: "none",
      bio: "",
      username: user.email ? user.email.split("@")[0] : `user_${user.uid.substring(0, 5)}`,
    });
    console.log(`Created Firestore profile for new Auth user: ${user.uid}`);
  }
});

/**
 * Cleanup user data when user is deleted from Auth Console or Programmatically.
 */
export const cleanupOnAuthDelete = functions.auth.user().onDelete(async (user: functions.auth.UserRecord) => {
  if (!user) return;

  console.log(`Auth user deleted: ${user.uid}. Starting cleanup...`);
  await cleanupUserData(user.uid);

  // Also try to delete the user document itself if it still exists
  // (This might trigger onUserDeleted, but that's fine, cleanup is idempotent-ish)
  await db.collection("users").doc(user.uid).delete();
});

// ==================== CLEANUP HELPERS ====================

/**
 * Shared logic to cleanup all user resources.
 */
async function cleanupUserData(userId: string) {
  console.log(`Running cleanupUserData for: ${userId}`);
  const batch = db.batch();
  let deleteCount = 0;

  try {
    // 1. Delete user's trips
    const tripsSnapshot = await db.collection("trips")
      .where("userId", "==", userId)
      .get();

    for (const doc of tripsSnapshot.docs) {
      // Also delete trip comments subcollection
      const commentsSnapshot = await doc.ref.collection("comments").get();
      for (const comment of commentsSnapshot.docs) {
        batch.delete(comment.ref);
        deleteCount++;
      }
      batch.delete(doc.ref);
      deleteCount++;
    }

    // 2. Delete push_tokens document
    const pushTokenRef = db.collection("push_tokens").doc(userId);
    batch.delete(pushTokenRef);
    deleteCount++;

    // 3. Remove user from chats and delete chats where user is the only participant
    const chatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      if (participants.length <= 1) {
        // User is the only participant, delete the chat
        batch.delete(chatDoc.ref);
        deleteCount++;
      } else {
        // Remove user from participants
        batch.update(chatDoc.ref, {
          participants: admin.firestore.FieldValue.arrayRemove(userId)
        });
      }
    }

    // 4. Delete user's storage files
    const bucket = admin.storage().bucket();

    // Delete profile images
    try {
      await bucket.deleteFiles({ prefix: `profiles/${userId}/` });
    } catch (e) {
      console.log(`No profile images to delete for user ${userId}`);
    }

    // Delete trip images
    try {
      await bucket.deleteFiles({ prefix: `trips/${userId}/` });
    } catch (e) {
      console.log(`No trip images to delete for user ${userId}`);
    }

    // Commit all Firestore deletions
    if (deleteCount > 0) {
      await batch.commit();
    }

    console.log(`Cleanup complete for ${userId}. Deleted/updated ${deleteCount} docs.`);
  } catch (error) {
    console.error(`Error cleaning up user ${userId}:`, error);
  }
}


/**
 * Cascade delete all user data when a user document is deleted.
 * This cleans up: trips, chats, storage files, push_tokens, etc.
 */
export const onUserDeleted = onDocumentDeleted(
  { document: "users/{userId}", database: "default" },
  async (event) => {
    if (!event.data) return;
    const userId = event.params.userId;
    console.log(`Firestore User Document deleted: ${userId}. Triggering cleanup...`);
    await cleanupUserData(userId);
  });

// ==================== JSON IMPORT FROM CLOUD STORAGE ====================

/**
 * HTTP Cloud Function to import JSON data from Cloud Storage to Firestore.
 * 
 * Usage: POST to this function URL with body:
 * {
 *   "bucketPath": "path/to/file.json",  // Path in Cloud Storage
 *   "collection": "splash_carousel",     // Target Firestore collection
 *   "useIdField": "id"                   // Optional: field to use as document ID
 * }
 * 
 * Or call with query params:
 * ?bucketPath=path/to/file.json&collection=splash_carousel&useIdField=id
 */
export const importJsonToFirestore = onRequest(
  { cors: true, region: "asia-south1" },
  async (req, res) => {
    try {
      // Get parameters from body or query
      const bucketPath = req.body?.bucketPath || req.query.bucketPath;
      const collection = req.body?.collection || req.query.collection;
      const useIdField = req.body?.useIdField || req.query.useIdField;

      if (!bucketPath || !collection) {
        res.status(400).json({
          error: "Missing required parameters",
          usage: "POST with { bucketPath: 'path/to/file.json', collection: 'targetCollection', useIdField: 'id' }"
        });
        return;
      }

      console.log(`Importing ${bucketPath} to collection ${collection}`);

      // Get the file from Cloud Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(bucketPath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: `File not found: ${bucketPath}` });
        return;
      }

      // Download and parse JSON
      const [contents] = await file.download();
      const jsonData = JSON.parse(contents.toString("utf8"));

      // Handle both array and single object
      const items = Array.isArray(jsonData) ? jsonData : [jsonData];

      if (items.length === 0) {
        res.status(400).json({ error: "JSON file is empty" });
        return;
      }

      // Use batch writes for efficiency
      const batch = db.batch();
      let count = 0;

      for (const item of items) {
        let docRef;

        // Use specified field as document ID, or auto-generate
        if (useIdField && item[useIdField]) {
          docRef = db.collection(collection).doc(String(item[useIdField]));
        } else {
          docRef = db.collection(collection).doc();
        }

        batch.set(docRef, {
          ...item,
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      }

      await batch.commit();

      console.log(`Successfully imported ${count} documents to ${collection}`);

      res.status(200).json({
        success: true,
        message: `Imported ${count} documents to collection '${collection}'`,
        collection,
        documentsCreated: count,
      });

    } catch (error: any) {
      console.error("Import error:", error);
      res.status(500).json({
        error: "Import failed",
        message: error.message,
      });
    }
  }
);

/**
 * Simple HTTP function to directly import carousel data without needing a file.
 * Just call this URL to set up the splash carousel.
 */
export const setupCarousel = onRequest(
  { cors: true, region: "asia-south1" },
  async (req, res) => {
    try {
      const carouselData = [
        { id: "1", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", title: "Ladakh", subtitle: "Ride through the mountains", location: "Khardung La Pass" },
        { id: "2", image: "https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800", title: "Himalayas", subtitle: "Touch the clouds", location: "Valley of Flowers" },
        { id: "3", image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800", title: "Kerala", subtitle: "Backwater paradise", location: "Alleppey" },
        { id: "4", image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800", title: "Goa", subtitle: "Beach vibes", location: "Palolem Beach" },
        { id: "5", image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800", title: "Rajasthan", subtitle: "Desert adventures", location: "Jaisalmer" },
      ];

      // Write to app_config/splash_carousel (the format the app expects)
      await db.collection("app_config").doc("splash_carousel").set({
        images: carouselData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Carousel setup complete!");

      res.status(200).json({
        success: true,
        message: "Carousel data written to app_config/splash_carousel",
        imagesCount: carouselData.length,
      });

    } catch (error: any) {
      console.error("Setup carousel error:", error);
      res.status(500).json({
        error: "Setup failed",
        message: error.message,
      });
    }
  }
);
