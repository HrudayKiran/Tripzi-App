import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";

// Use 'functions' for v1 triggers (Auth)
// Use 'functions' for v1 triggers (Auth)
import * as functions from "firebase-functions/v1";
// v2 https imports removed - not currently used
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

// Set global options for all v2 functions
setGlobalOptions({ region: "asia-south1" });

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
 * Send notification when someone comments on a trip.
 * Listens to subcollection: trips/{tripId}/comments/{commentId}
 */
export const onCommentCreated = onDocumentCreated(
  { document: "trips/{tripId}/comments/{commentId}", database: "default" },
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

    // Helper to truncate text
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

// ==================== RATING NOTIFICATIONS & AGGREGATION ====================

/**
 * 1. Notify host when rated.
 * 2. Update host's average rating field.
 */
export const onRatingCreated = onDocumentCreated(
  { document: "ratings/{ratingId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const rating = event.data.data();
    // rating: { tripId, hostId, userId, rating, feedback, ... }

    if (!rating.hostId || !rating.rating) return;

    // A. AGGREGATION: Update User's Average Rating
    const ratingsSnapshot = await db.collection("ratings")
      .where("hostId", "==", rating.hostId)
      .get();

    let total = 0;
    ratingsSnapshot.forEach(doc => {
      total += (doc.data().rating || 0);
    });

    const count = ratingsSnapshot.size;
    const average = count > 0 ? Number((total / count).toFixed(1)) : 0;

    await db.collection("users").doc(rating.hostId).update({
      rating: average
    });

    // B. NOTIFICATION: Notify Host
    const raterDoc = await db.collection("users").doc(rating.userId).get();
    const rater = raterDoc.data() || {};

    await createNotification({
      recipientId: rating.hostId,
      type: "rating",
      title: "New Rating! ⭐",
      message: `${rater.displayName || "Someone"} gave you ${rating.rating} stars!`,
      entityId: rating.tripId,
      entityType: "trip",
      actorId: rating.userId,
      actorName: rater.displayName,
      actorPhotoUrl: rater.photoURL,
      deepLinkRoute: "TripDetails", // Or Profile
      deepLinkParams: { tripId: rating.tripId },
    });

    await sendPushToUser(rating.hostId, {
      title: "New Rating! ⭐",
      body: `You received a ${rating.rating}-star rating from ${rater.displayName || "Someone"}.`,
      data: { route: "UserProfile", userId: rating.hostId }, // Go to own profile to see stats
    });
  });

// ==================== FOLLOW NOTIFICATION ====================

/**
 * Detect when 'followers' array changes => Send Notification.
 */
export const onUserFollowed = onDocumentUpdated(
  { document: "users/{userId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const userId = event.params.userId; // The user BEING followed

    const beforeFollowers = before.followers || [];
    const afterFollowers = after.followers || [];

    // Find new followers
    const newFollowers = afterFollowers.filter((uid: string) => !beforeFollowers.includes(uid));

    if (newFollowers.length === 0) return;

    for (const followerId of newFollowers) {
      const followerDoc = await db.collection("users").doc(followerId).get();
      const follower = followerDoc.data() || {};

      await createNotification({
        recipientId: userId,
        type: "follow",
        title: "New Follower! 👋",
        message: `${follower.displayName || "Someone"} started following you.`,
        entityId: followerId,
        entityType: "user",
        actorId: followerId,
        actorName: follower.displayName,
        actorPhotoUrl: follower.photoURL,
        deepLinkRoute: "UserProfile",
        deepLinkParams: { userId: followerId },
      });

      await sendPushToUser(userId, {
        title: "New Follower! 👋",
        body: `${follower.displayName || "Someone"} started following you.`,
        data: { route: "UserProfile", userId: followerId },
      });
    }
  });

// ==================== STORY NOTIFICATION ====================

/**
 * Notify followers when a user posts a story.
 * (Limited to batch sending to avoid massive fanout bills, usually topics are better here)
 * For MVP: We will just log it or send to top 5 followers? 
 * Actually, let's skip massive fanout for now as it's dangerous for free tier. 
 * We will fully implement it but Commented OUT the heavy loop.
 */
export const onStoryCreated = onDocumentCreated(
  { document: "stories/{storyId}", database: "default" },
  async (event) => {
    // Placeholder for Story Notifications
    // Requires Fetching all followers -> Sending msg.
    // Dangerous for > 100 followers on Blaze/Spark plan limits.
    // console.log("Story created - Notification logic reserved for scalability update.");
    return;
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
    // Fetch fresh user data to get the latest displayName (in case client updated it quickly)
    let freshUser = user;
    try {
      freshUser = await admin.auth().getUser(user.uid);
    } catch (e) {
      console.log("Error fetching fresh user data, using event data:", e);
    }

    await userRef.set({
      userId: user.uid,
      email: user.email,
      displayName: freshUser.displayName || user.displayName || "",
      photoURL: freshUser.photoURL || user.photoURL || null,
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

// NOTE: cleanupOnAuthDelete has been removed - use cleanupAccountOnAuthDelete instead

// ==================== CLEANUP HELPERS ====================

/**
 * Shared logic to cleanup all user resources.
 */
async function cleanupUserData(userId: string) {
  console.log(`Running cleanupUserData for: ${userId}`);
  let deleteCount = 0;

  // Use individual try-catch for each section so one failure doesn't stop others

  // 1. Delete user's trips and their comments
  try {
    const tripsSnapshot = await db.collection("trips")
      .where("userId", "==", userId)
      .get();

    for (const doc of tripsSnapshot.docs) {
      // Delete trip comments subcollection
      try {
        const commentsSnapshot = await doc.ref.collection("comments").get();
        for (const comment of commentsSnapshot.docs) {
          await comment.ref.delete();
          deleteCount++;
        }
      } catch (e) {
        console.log(`Could not delete comments for trip ${doc.id}`);
      }
      await doc.ref.delete();
      deleteCount++;
    }
    console.log(`Deleted ${tripsSnapshot.size} trips for ${userId}`);
  } catch (e: any) {
    console.log(`Error deleting trips for ${userId}:`, e.message);
  }

  // 2. Delete user's stories
  try {
    const storiesSnapshot = await db.collection("stories")
      .where("userId", "==", userId)
      .get();
    for (const doc of storiesSnapshot.docs) {
      await doc.ref.delete();
      deleteCount++;
    }
    console.log(`Deleted ${storiesSnapshot.size} stories for ${userId}`);
  } catch (e: any) {
    console.log(`Error deleting stories for ${userId}:`, e.message);
  }

  // 3. Delete ratings made by user
  try {
    const ratingsSnapshot = await db.collection("ratings")
      .where("userId", "==", userId)
      .get();
    for (const doc of ratingsSnapshot.docs) {
      await doc.ref.delete();
      deleteCount++;
    }
    console.log(`Deleted ${ratingsSnapshot.size} ratings for ${userId}`);
  } catch (e: any) {
    console.log(`Error deleting ratings for ${userId}:`, e.message);
  }

  // 4. Delete push_tokens document (CRITICAL)
  try {
    await db.collection("push_tokens").doc(userId).delete();
    console.log(`Deleted push_token for ${userId}`);
    deleteCount++;
  } catch (e: any) {
    console.log(`Error deleting push_token for ${userId}:`, e.message);
  }

  // 5. Remove user from chats and delete chats where user is the only participant
  try {
    const chatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      if (participants.length <= 1) {
        await chatDoc.ref.delete();
        deleteCount++;
      } else {
        await chatDoc.ref.update({
          participants: admin.firestore.FieldValue.arrayRemove(userId)
        });
      }
    }
    console.log(`Processed ${chatsSnapshot.size} chats for ${userId}`);
  } catch (e: any) {
    console.log(`Error processing chats for ${userId}:`, e.message);
  }

  // 6. Delete user's storage files (CRITICAL)
  // Use explicit bucket name for reliability
  const bucketName = "tripzi-app.firebasestorage.app";
  const bucket = admin.storage().bucket(bucketName);

  // Delete profile images
  try {
    console.log(`Deleting storage: profiles/${userId}/`);
    await bucket.deleteFiles({ prefix: `profiles/${userId}/` });
    console.log(`Deleted profile images for ${userId}`);
  } catch (e: any) {
    console.log(`No profile images to delete or storage error for user ${userId}:`, e.message);
  }

  // Delete trip images
  try {
    console.log(`Deleting storage: trips/${userId}/`);
    await bucket.deleteFiles({ prefix: `trips/${userId}/` });
    console.log(`Deleted trip images for ${userId}`);
  } catch (e: any) {
    console.log(`No trip images to delete or storage error for user ${userId}:`, e.message);
  }

  // Delete trip videos (New)
  try {
    console.log(`Deleting storage: trip_videos/${userId}/`);
    await bucket.deleteFiles({ prefix: `trip_videos/${userId}/` });
    console.log(`Deleted trip videos for ${userId}`);
  } catch (e: any) {
    console.log(`No trip videos to delete or storage error for user ${userId}:`, e.message);
  }

  // 7. Remove Live Location Shares (New)
  try {
    // This is hard to query efficiently without a collection group index on 'userId', 
    // but we can assume live shares are transient. 
    // A better approach for critical cleanup would be a Collection Group query.
    // For now, let's try a best-effort Collection Group query if index exists, 
    // otherwise relies on expiration function.
    // NOTE: This assumes 'live_shares' is a subcollection name used consistently.
    try {
      const liveSharesSnap = await db.collectionGroup("live_shares").where("userId", "==", userId).get();
      const batch = db.batch();
      let liveShareCount = 0;
      liveSharesSnap.forEach(doc => {
        batch.delete(doc.ref);
        liveShareCount++;
      });
      if (liveShareCount > 0) {
        await batch.commit();
        console.log(`Deleted ${liveShareCount} live location shares for ${userId}`);
      }
    } catch (indexError) {
      console.log("Could not clean live_shares (likely missing index). They will expire naturally.");
    }
  } catch (e: any) {
    console.log(`Error cleaning live shares for ${userId}:`, e.message);
  }

  console.log(`Cleanup complete for ${userId}. Deleted/updated ${deleteCount} docs.`);
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

/**
 * Trigger cleanup when the Firebase Auth account is deleted.
 * This is the primary trigger for the "Delete Account" feature in the app.
 */
/**
 * Trigger cleanup when the Firebase Auth account is deleted.
 * This is the primary trigger for the "Delete Account" feature in the app.
 * Using v1 trigger because v2 identity events are primarily blocking.
 */
export const cleanupAccountOnAuthDelete = functions.auth.user().onDelete(async (user: functions.auth.UserRecord) => {
  console.log(`Auth User deleted: ${user.uid}. Triggering cleanup...`);

  // 1. Run the standard cleanup (Push tokens, trips, storage)
  await cleanupUserData(user.uid);

  // 2. Explicitly delete the Firestore User Document 
  // (This ensures the profile is gone, avoiding ghost users)
  try {
    await admin.firestore().collection("users").doc(user.uid).delete();
    console.log(`Verified Firestore profile deleted for ${user.uid}`);
  } catch (e) {
    console.log(`Error deleting user profile doc:`, e);
  }
});

/**
 * Callable Cloud Function to delete the current user's account.
 * Uses admin privileges, so no reauthentication is required on the client.
 * Runs cleanup DIRECTLY to guarantee deletion (doesn't rely on trigger).
 */
export const deleteMyAccount = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete your account.");
  }

  const uid = context.auth.uid;
  console.log(`deleteMyAccount called for user: ${uid}`);

  try {
    // 1. Run cleanup FIRST (before deleting auth, to guarantee it runs)
    console.log(`Running cleanup for ${uid} BEFORE auth deletion...`);
    await cleanupUserData(uid);

    // 2. Delete the Firestore user document explicitly
    try {
      await admin.firestore().collection("users").doc(uid).delete();
      console.log(`Deleted Firestore user doc for ${uid}`);
    } catch (e) {
      console.log(`User doc may not exist or already deleted:`, e);
    }

    // 3. Delete the Auth user using Admin SDK
    await admin.auth().deleteUser(uid);
    console.log(`Successfully deleted Auth user: ${uid}`);

    return { success: true, message: "Account deleted successfully." };
  } catch (error: any) {
    console.error(`Failed to delete user ${uid}:`, error);
    throw new functions.https.HttpsError("internal", "Failed to delete account. Please try again.");
  }
});

// ==================== MESSAGE MEDIA DELETION ====================

/**
 * Delete media from Storage when a message is deleted for everyone.
 * Triggers when 'deletedForEveryoneAt' is set on a message.
 */
export const deleteMessageMedia = onDocumentUpdated(
  { document: "chats/{chatId}/messages/{messageId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only trigger if deletedForEveryoneAt was just set
    if (before.deletedForEveryoneAt || !after.deletedForEveryoneAt) return;

    console.log(`Message ${event.params.messageId} deleted for everyone. Cleaning up media...`);

    const mediaUrl = after.mediaUrl;
    if (!mediaUrl) {
      console.log("No media URL to delete.");
      return;
    }

    try {
      // Extract path from Firebase Storage URL
      // Format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH%2FFILE?...
      const urlMatch = mediaUrl.match(/o\/([^?]+)/);
      if (!urlMatch) {
        console.log("Could not extract path from URL:", mediaUrl);
        return;
      }

      const filePath = decodeURIComponent(urlMatch[1]);
      console.log("Deleting file at path:", filePath);

      await admin.storage().bucket().file(filePath).delete();
      console.log(`Successfully deleted media: ${filePath}`);
    } catch (error: any) {
      // File might already be deleted or path is invalid
      if (error.code === 404) {
        console.log("File already deleted or not found.");
      } else {
        console.error("Error deleting media:", error);
      }
    }
  }
);

// ==================== SHARE LINK GENERATION ====================

/**
 * Generate a shareable deep link for a trip.
 * Returns a URL that can be shared to other apps.
 */
export const generateShareLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to generate share links.");
  }

  const { tripId, tripTitle } = data;

  if (!tripId) {
    throw new functions.https.HttpsError("invalid-argument", "Trip ID is required.");
  }

  // Verify trip exists
  const tripDoc = await db.collection("trips").doc(tripId).get();
  if (!tripDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Trip not found.");
  }

  // Generate deep link (can be enhanced with Firebase Dynamic Links later)
  const webLink = `https://tripzi.app/trip/${tripId}`;
  const appLink = `tripzi://trip/${tripId}`;

  return {
    webLink,
    appLink,
    title: tripTitle || tripDoc.data()?.title || "Check out this trip!",
    message: `🗺️ Check out this amazing trip on Tripzi!\n\n${webLink}`,
  };
});

// NOTE: spotifySearch function has been moved to future implementation.
// See implementation_plan.md for Spotify API integration when ready.

// NOTE: importJsonToFirestore and setupCarousel have been removed to reduce quota usage.
// If needed again, they can be restored from git history.
