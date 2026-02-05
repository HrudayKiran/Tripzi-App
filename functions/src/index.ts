import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Use 'functions' for v1 triggers (Auth)
// Use 'functions' for v1 triggers (Auth)
import * as functions from "firebase-functions/v1";
// v2 https imports removed - not currently used
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

import { getFirestore } from "firebase-admin/firestore";

// Set global options for all v2 functions
setGlobalOptions({ region: "asia-south1" });

// Initialize Firebase Admin (relies on environment variables)
admin.initializeApp();

// Explicitly use the (default) database as requested
// This avoids the ambiguity where "default" might be interpreted as a database named "default"
const db = getFirestore(admin.app(), '(default)');

// Note: Explicit settings removed to allow auto-configuration
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

// ==================== KYC NOTIFICATION FUNCTION ====================

/**
 * Send push and in-app notification when user KYC status changes to 'verified'.
 */
export const onKycStatusChange = onDocumentUpdated(
  { document: "users/{userId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const userId = event.params.userId;

    // Check if kycStatus changed to 'verified'
    if (before?.kycStatus !== 'verified' && after?.kycStatus === 'verified') {
      console.log(`KYC approved for user ${userId}`);

      // Send push notification
      await sendPushToUser(userId, {
        title: '🎉 KYC Approved!',
        body: 'Your identity has been verified. You now have full access to Tripzi!',
        data: { type: 'kyc_approved', userId },
      });

      // Create in-app notification
      await createNotification({
        recipientId: userId,
        type: 'kyc_approved',
        title: 'KYC Verification Complete',
        message: 'Your identity has been verified successfully! You now have full access to all features.',
        entityType: 'user',
        entityId: userId,
        deepLinkRoute: 'Profile',
        deepLinkParams: { userId },
      });

      console.log(`KYC notification sent to user ${userId}`);
    }

    // Handle KYC rejection
    if (before?.kycStatus !== 'rejected' && after?.kycStatus === 'rejected') {
      console.log(`KYC rejected for user ${userId}`);

      await sendPushToUser(userId, {
        title: '❌ KYC Review Required',
        body: 'Your identity verification needs attention. Please check and resubmit.',
        data: { type: 'kyc_rejected', userId },
      });

      await createNotification({
        recipientId: userId,
        type: 'kyc_rejected',
        title: 'KYC Verification Issue',
        message: 'Your identity verification was not approved. Please check the requirements and try again.',
        entityType: 'user',
        entityId: userId,
        deepLinkRoute: 'KYC',
        deepLinkParams: { userId },
      });
    }
  }
);

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

// ==================== CHAT CLEANUP ====================

/**
 * Clean up messages subcollection and chat media when a chat is deleted.
 */
export const onChatDeleted = onDocumentDeleted(
  { document: "chats/{chatId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const chatId = event.params.chatId;
    console.log(`Chat ${chatId} deleted, cleaning up messages and media...`);

    try {
      // 1. Delete all messages in the subcollection
      const messagesSnapshot = await db.collection("chats").doc(chatId).collection("messages").get();

      if (!messagesSnapshot.empty) {
        const batch = db.batch();
        let count = 0;

        for (const doc of messagesSnapshot.docs) {
          batch.delete(doc.ref);
          count++;

          // Firestore batch limit is 500
          if (count >= 450) {
            await batch.commit();
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        console.log(`Deleted ${messagesSnapshot.size} messages from chat ${chatId}`);
      }

      // 2. Delete chat media from Storage
      const storage = admin.storage().bucket();
      const [files] = await storage.getFiles({ prefix: `chats/${chatId}/` });

      if (files.length > 0) {
        await Promise.all(files.map(file => file.delete()));
        console.log(`Deleted ${files.length} media files from chat ${chatId}`);
      }
    } catch (error) {
      console.error(`Error cleaning up chat ${chatId}:`, error);
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

// ==================== TRIP JOIN/LEAVE NOTIFICATIONS ====================

/**
 * Send notification when someone joins OR leaves a trip.
 */
export const onTripParticipantChange = onDocumentUpdated(
  { document: "trips/{tripId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const tripId = event.params.tripId;

    const beforeParticipants = before.participants || [];
    const afterParticipants = after.participants || [];

    // Check if a new participant was added (JOIN)
    const newParticipants = afterParticipants.filter(
      (uid: string) => !beforeParticipants.includes(uid)
    );

    // Check if a participant was removed (LEAVE)
    const leftParticipants = beforeParticipants.filter(
      (uid: string) => !afterParticipants.includes(uid)
    );

    // Handle JOINs
    for (const newUserId of newParticipants) {
      if (newUserId === after.userId) continue;

      const joinerDoc = await db.collection("users").doc(newUserId).get();
      const joiner = joinerDoc.data() || {};

      await createNotification({
        recipientId: after.userId,
        type: "trip_join",
        title: "New Trip Member! 🎒",
        message: `${joiner.displayName || "Someone"} joined your trip "${after.title || after.destination}"`,
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
        body: `${joiner.displayName || "Someone"} joined your trip "${after.title || after.destination}"`,
        data: { route: "TripDetails", tripId },
      });
    }

    // Handle LEAVEs
    for (const leftUserId of leftParticipants) {
      if (leftUserId === after.userId) continue;

      const leaverDoc = await db.collection("users").doc(leftUserId).get();
      const leaver = leaverDoc.data() || {};

      await createNotification({
        recipientId: after.userId,
        type: "trip_leave",
        title: "Traveler Left 👋",
        message: `${leaver.displayName || "Someone"} left your trip "${after.title || after.destination}"`,
        entityId: tripId,
        entityType: "trip",
        actorId: leftUserId,
        actorName: leaver.displayName,
        actorPhotoUrl: leaver.photoURL,
        deepLinkRoute: "TripDetails",
        deepLinkParams: { tripId },
      });

      await sendPushToUser(after.userId, {
        title: "Traveler Left 👋",
        body: `${leaver.displayName || "Someone"} left your trip "${after.title || after.destination}"`,
        data: { route: "TripDetails", tripId },
      });
    }
  });

// ==================== TRIP CANCELLED NOTIFICATION ====================

/**
 * Notify all participants when a trip is deleted/cancelled.
 */
export const onTripDeleted = onDocumentDeleted(
  { document: "trips/{tripId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const tripData = event.data.data();
    const tripId = event.params.tripId;
    const participants = tripData.participants || [];
    const tripTitle = tripData.title || tripData.destination || "A trip";
    const hostId = tripData.userId;

    // Get host name
    let hostName = "The host";
    if (hostId) {
      const hostDoc = await db.collection("users").doc(hostId).get();
      hostName = hostDoc.data()?.displayName || "The host";
    }

    // Notify all participants (except the owner who deleted it)
    for (const participantId of participants) {
      if (participantId === hostId) continue;

      await createNotification({
        recipientId: participantId,
        type: "trip_cancelled",
        title: "Trip Cancelled ⚠️",
        message: `"${tripTitle}" by ${hostName} has been cancelled`,
        entityId: tripId,
        entityType: "trip",
        deepLinkRoute: "Feed",
        deepLinkParams: {},
      });

      await sendPushToUser(participantId, {
        title: "Trip Cancelled ⚠️",
        body: `"${tripTitle}" by ${hostName} has been cancelled`,
        data: { route: "Feed" },
      });
    }

    console.log(`Trip ${tripId} cancelled, notified ${participants.length - 1} participants`);
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

    // Send push notification (delayed slightly to allow FCM token registration)
    setTimeout(async () => {
      await sendPushToUser(userId, {
        title: "Welcome to Tripzi! 🌍",
        body: "Complete your KYC to start creating and joining trips!",
        data: { route: "KycScreen" },
      });
    }, 5000);
  });

// ==================== REPORT NOTIFICATIONS ====================

/**
 * Notify admins when a new report is submitted.
 */
export const onReportCreated = onDocumentCreated(
  { document: "reports/{reportId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const report = event.data.data();
    const reportId = event.params.reportId;
    const reporterDoc = await db.collection("users").doc(report.reporterId).get();
    const reporter = reporterDoc.data() || {};

    // Get all admins
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();

    for (const adminDoc of adminsSnapshot.docs) {
      await createNotification({
        recipientId: adminDoc.id,
        type: "report",
        title: "🚨 New Report",
        message: `${reporter.displayName || "Someone"} reported ${report.type || "content"}`,
        entityId: reportId,
        entityType: "report",
        actorId: report.reporterId,
        actorName: reporter.displayName,
        actorPhotoUrl: reporter.photoURL,
        deepLinkRoute: "AdminDashboard",
        deepLinkParams: {},
      });

      await sendPushToUser(adminDoc.id, {
        title: "🚨 New Report",
        body: `${reporter.displayName || "Someone"} reported ${report.type || "content"}`,
        data: { route: "AdminDashboard" },
      });
    }
  });

/**
 * Notify reporter when their report status changes.
 */
export const onReportUpdated = onDocumentUpdated(
  { document: "reports/{reportId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only trigger if status changed
    if (before.status === after.status) return;

    const statusMessages: { [key: string]: string } = {
      investigating: "Your report is being investigated by our team.",
      resolved: "Your report has been resolved. Thank you for helping keep Tripzi safe!",
      dismissed: "Your report was reviewed but no action was taken at this time.",
    };

    const message = statusMessages[after.status] || `Your report status changed to: ${after.status}`;

    await createNotification({
      recipientId: after.reporterId,
      type: "report_update",
      title: `Report ${after.status.charAt(0).toUpperCase() + after.status.slice(1)}`,
      message,
      entityId: event.params.reportId,
      entityType: "report",
      deepLinkRoute: "Profile",
      deepLinkParams: {},
    });

    await sendPushToUser(after.reporterId, {
      title: `Report ${after.status.charAt(0).toUpperCase() + after.status.slice(1)}`,
      body: message,
      data: { route: "Profile" },
    });
  });


// ==================== AUTH TRIGGERS (v1) ====================

// NOTE: createProfileOnAuth has been removed - profiles are created explicitly during sign-up flow
// NOTE: cleanupOnAuthDelete has been removed - use cleanupAccountOnAuthDelete instead

/**
 * Scheduled function to clean up orphaned Firebase Auth users.
 * Deletes Auth users who don't have a corresponding Firestore profile.
 * This handles users who clicked "Continue with Google" but never completed sign-up.
 * Runs every hour to keep Auth records clean.
 */
export const cleanupOrphanedAuthUsers = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    console.log("Starting orphaned Auth user cleanup...");
    let deletedCount = 0;
    let checkedCount = 0;
    let nextPageToken: string | undefined;

    try {
      do {
        // List users in batches (max 1000 per request)
        const listResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const user of listResult.users) {
          checkedCount++;

          // Skip users created in the last 5 minutes (give them time to complete sign-up)
          const createdAt = new Date(user.metadata.creationTime).getTime();
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          if (createdAt > fiveMinutesAgo) {
            console.log(`Skipping recent user ${user.uid} - created less than 5 minutes ago`);
            continue;
          }

          // Check if user has a Firestore profile
          const userDoc = await db.collection("users").doc(user.uid).get();

          if (!userDoc.exists) {
            // User has Auth but no Firestore profile - delete them
            console.log(`Deleting orphaned Auth user: ${user.uid} (${user.email || 'no email'})`);
            await admin.auth().deleteUser(user.uid);
            deletedCount++;
          }
        }

        nextPageToken = listResult.pageToken;
      } while (nextPageToken);

      console.log(`Cleanup complete. Checked: ${checkedCount}, Deleted: ${deletedCount}`);
      return { checked: checkedCount, deleted: deletedCount };
    } catch (error) {
      console.error("Error during orphaned user cleanup:", error);
      throw error;
    }
  });


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

// ==================== STORAGE CLEANUP FUNCTIONS ====================

/**
 * Callable function to clean up orphaned/duplicate trip media in Storage.
 * This removes files that are not referenced in any Firestore trip documents.
 */
export const cleanupOrphanedTripMedia = functions.https.onCall(async (data, context) => {
  // Allow admin bypass with secret key for console testing
  const ADMIN_KEY = "tripzi-cleanup-2026";

  // Either authenticated OR using admin key
  if (!context.auth && data.adminKey !== ADMIN_KEY) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in or provide adminKey.");
  }

  // Require userId to be passed explicitly when using admin key
  if (!data.userId) {
    throw new functions.https.HttpsError("invalid-argument", "userId is required.");
  }

  const userId = data.userId;
  const bucketName = "tripzi-app.firebasestorage.app";
  const bucket = admin.storage().bucket(bucketName);

  let deletedCount = 0;
  const errors: string[] = [];

  try {
    // Get all trips for this user to know which images are valid
    const tripsSnapshot = await db.collection("trips").where("userId", "==", userId).get();

    const validImageUrls = new Set<string>();
    const validVideoUrls = new Set<string>();

    tripsSnapshot.forEach(doc => {
      const tripData = doc.data();
      // Add all image URLs
      if (tripData.images && Array.isArray(tripData.images)) {
        tripData.images.forEach((url: string) => validImageUrls.add(url));
      }
      if (tripData.coverImage) validImageUrls.add(tripData.coverImage);
      // Add video URL
      if (tripData.video) validVideoUrls.add(tripData.video);
    });

    console.log(`Found ${validImageUrls.size} valid image URLs and ${validVideoUrls.size} valid video URLs for user ${userId}`);

    // List all files in trips/{userId}/ and trip_videos/{userId}/
    const [tripFiles] = await bucket.getFiles({ prefix: `trips/${userId}/` });
    const [videoFiles] = await bucket.getFiles({ prefix: `trip_videos/${userId}/` });

    // Check each trip image file
    for (const file of tripFiles) {
      try {
        // Check if this file's URL is in our valid set (using partial match)

        // Check if this file's URL is in our valid set (using partial match since signed URLs differ)
        const isReferenced = Array.from(validImageUrls).some(validUrl =>
          validUrl.includes(encodeURIComponent(file.name)) || file.name.includes(validUrl.split('/').pop()?.split('?')[0] || '')
        );

        if (!isReferenced) {
          await file.delete();
          deletedCount++;
          console.log(`Deleted orphaned image: ${file.name}`);
        }
      } catch (e: any) {
        errors.push(`Error processing ${file.name}: ${e.message}`);
      }
    }

    // Check each video file
    for (const file of videoFiles) {
      try {
        const isReferenced = Array.from(validVideoUrls).some(validUrl =>
          validUrl.includes(encodeURIComponent(file.name)) || file.name.includes(validUrl.split('/').pop()?.split('?')[0] || '')
        );

        if (!isReferenced) {
          await file.delete();
          deletedCount++;
          console.log(`Deleted orphaned video: ${file.name}`);
        }
      } catch (e: any) {
        errors.push(`Error processing ${file.name}: ${e.message}`);
      }
    }

    return {
      success: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Cleaned up ${deletedCount} orphaned files for user ${userId}`,
    };
  } catch (error: any) {
    console.error("Cleanup error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Admin-only function to clean up ALL orphaned media across all users.
 * Use with caution - this scans the entire storage bucket.
 */
export const adminCleanupAllOrphanedMedia = functions.https.onCall(async (data, context) => {
  // Only allow admins
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }

  // Check if user is admin
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  // This would be a heavy operation - for now, return guidance
  return {
    message: "For large-scale cleanup, please use the Firebase Console Storage browser or run cleanupOrphanedTripMedia per-user.",
    hint: "You can iterate through users collection and call cleanupOrphanedTripMedia for each.",
  };
});

// ==================== RATE LIMITING (Security) ====================

const rateLimiter = new Map<string, number[]>();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60000; // 1 minute

/**
 * Helper to check rate limits for callable functions.
 * Throws an error if limit exceeded.
 */
export const checkRateLimit = (uid: string) => {
  const now = Date.now();
  const userRequests = rateLimiter.get(uid) || [];
  const recentRequests = userRequests.filter(t => now - t < WINDOW_MS);

  if (recentRequests.length >= MAX_REQUESTS) {
    throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please try again later.');
  }

  recentRequests.push(now);
  rateLimiter.set(uid, recentRequests);
};

// ==================== HOST RATING IMPACT ====================

/**
 * Cloud Function to handle impact on host when a report is resolved.
 * Can apply warnings, rating penalties, or suspensions.
 */
export const onReportResolved = onDocumentUpdated(
  { document: "reports/{reportId}", database: "default" },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only process when status changes to resolved
    if (before.status === 'resolved' || after.status !== 'resolved') return;

    const resolution = after.resolution;
    const hostId = after.reportedUserId;
    if (!hostId) return;

    console.log(`Processing resolution '${resolution}' for host ${hostId}`);

    try {
      switch (resolution) {
        case 'warning':
          // Increment warning count
          await db.collection('users').doc(hostId).update({
            warningCount: admin.firestore.FieldValue.increment(1)
          });
          console.log(`Applied warning to host ${hostId}`);
          break;

        case 'rating_penalty':
          // Reduce organizer rating by 0.5
          const userDoc = await db.collection('users').doc(hostId).get();
          const currentRating = userDoc.data()?.organizerRating?.averageRating || 0;
          await db.collection('users').doc(hostId).update({
            'organizerRating.averageRating': Math.max(0, currentRating - 0.5)
          });
          console.log(`Applied rating penalty to host ${hostId}`);
          break;

        case 'suspend':
          // Suspend user account
          await db.collection('users').doc(hostId).update({
            suspended: true,
            suspendedUntil: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            )
          });
          console.log(`Suspended host ${hostId}`);
          break;
      }
    } catch (error) {
      console.error('Error applying resolution impact:', error);
    }
  }
);

// ==================== RATING AGGREGATION ====================

/**
 * Trigger when a new rating is added to a trip.
 * Recalculates trip average and organizer's overall rating.
 */
export const onRatingCreated = onDocumentCreated(
  { document: "trips/{tripId}/ratings/{ratingId}", database: "default" },
  async (event) => {
    if (!event.data) return;
    const { tripId } = event.params;

    console.log(`Processing new rating for trip ${tripId}`);

    try {
      // 1. Recalculate trip average
      const ratingsSnapshot = await db.collection(`trips/${tripId}/ratings`).get();
      const ratings = ratingsSnapshot.docs.map(d => d.data());

      if (ratings.length === 0) return;

      const avgRating = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;

      // Breakdown
      const breakdown: any = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      ratings.forEach(r => {
        const rounded = Math.round(r.rating || 0);
        if (breakdown[rounded] !== undefined) breakdown[rounded]++;
      });

      // Update trip
      await db.collection('trips').doc(tripId).update({
        ratingsData: {
          averageRating: Math.round(avgRating * 10) / 10,
          totalRatings: ratings.length,
          breakdown
        }
      });

      // 2. Update organizer profile average
      const tripDoc = await db.collection('trips').doc(tripId).get();
      const organizerId = tripDoc.data()?.userId;
      if (!organizerId) return;

      const allOrganizerTrips = await db.collection('trips').where('userId', '==', organizerId).get();
      let totalSum = 0;
      let totalCount = 0;

      allOrganizerTrips.docs.forEach(t => {
        const data = t.data();
        if (data.ratingsData?.averageRating) {
          const tripAvg = data.ratingsData.averageRating || 0;
          const tripCount = data.ratingsData.totalRatings || 0;

          if (tripCount > 0) {
            // Weighted by number of ratings
            totalSum += tripAvg * tripCount;
            totalCount += tripCount;
          }
        }
      });

      const userAvg = totalCount > 0 ? totalSum / totalCount : 0;

      // Determine badge
      let badge = 'New';
      if (userAvg >= 4.8 && totalCount > 10) badge = 'Outstanding';
      else if (userAvg >= 4.5 && totalCount > 5) badge = 'Highly Rated';
      else if (userAvg >= 4.0 && totalCount > 5) badge = 'Well Rated';
      else if (userAvg >= 3.0 && totalCount > 0) badge = 'Rated';

      await db.collection('users').doc(organizerId).update({
        organizerRating: {
          averageRating: Math.round(userAvg * 10) / 10,
          totalRatings: totalCount,
          badge
        }
      });

      console.log(`Updated ratings for trip ${tripId} and organizer ${organizerId}`);

      // 3. Send Notification to Host (Merged from old logic)
      const newRating = event.data.data();
      if (newRating && organizerId && newRating.userId && organizerId !== newRating.userId) {
        const raterDoc = await db.collection("users").doc(newRating.userId).get();
        const rater = raterDoc.data() || {};

        await createNotification({
          recipientId: organizerId,
          type: "rating",
          title: "New Rating! ⭐",
          message: `${rater.displayName || "Someone"} gave you ${newRating.rating} stars!`,
          entityId: tripId,
          entityType: "trip",
          actorId: newRating.userId,
          actorName: rater.displayName,
          actorPhotoUrl: rater.photoURL,
          deepLinkRoute: "TripDetails",
          deepLinkParams: { tripId },
        });

        await sendPushToUser(organizerId, {
          title: "New Rating! ⭐",
          body: `You received a ${newRating.rating}-star rating from ${rater.displayName || "Someone"}.`,
          data: { route: "UserProfile", userId: organizerId },
        });
      }

    } catch (error) {
      console.error('Error in onRatingCreated:', error);
    }
  }
);

// ==================== ADMIN UTILS ====================

/**
 * Utility to make a user an admin.
 * Sets the 'admin' role in Firestore and 'admin' custom claim for Auth.
 */
export const makeAdmin = onCall(async (request) => {
  // This function should be secured in production!
  // For now, it allows anyone to promote themselves or others during development.
  // In production, restrict this to existing admins or deploy once then remove.

  const { email } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email required');

  try {
    const userRec = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRec.uid, { admin: true });
    await db.collection('users').doc(userRec.uid).update({ role: 'admin' });
    return { success: true, message: `User ${email} is now an admin` };
  } catch (e: any) {
    throw new HttpsError('internal', e.message || 'Error making admin');
  }
});
