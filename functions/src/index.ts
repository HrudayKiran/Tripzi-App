import {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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
export const createGroupChatOnTripFull = onDocumentUpdated("trips/{tripId}", async (event) => {
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
          deepLinkParams: {chatId: chatRoomId},
        });

        await sendPushToUser(userId, {
          title: "Trip is Full! 🎉",
          body: `The trip "${tripData.title}" is now full. Check the group chat!`,
          data: {route: "Message", chatId: chatRoomId},
        });
      }
    }
  }
});

// ==================== LIKE NOTIFICATIONS ====================

/**
 * Send notification when someone likes a trip/post.
 */
export const onLikeCreated = onDocumentCreated("likes/{likeId}", async (event) => {
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
    deepLinkParams: {tripId: like.tripId},
  });

  await sendPushToUser(trip.userId, {
    title: "New Like! ❤️",
    body: `${liker.displayName || "Someone"} liked your trip to ${trip.destination}`,
    data: {route: "TripDetails", tripId: like.tripId},
  });
});

// ==================== COMMENT NOTIFICATIONS ====================

/**
 * Send notification when someone comments on a trip/post.
 */
export const onCommentCreated = onDocumentCreated("comments/{commentId}", async (event) => {
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
    deepLinkParams: {tripId: comment.tripId},
  });

  await sendPushToUser(trip.userId, {
    title: "New Comment 💬",
    body: `${commenter.displayName || "Someone"}: "${displayText}"`,
    data: {route: "TripDetails", tripId: comment.tripId},
  });
});

// ==================== MESSAGE NOTIFICATIONS ====================

/**
 * Send notification when a new message is received.
 */
export const onMessageCreated = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
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

  const displayName = chat.isGroupChat ?
    chat.groupName :
    sender.displayName || "Someone";

  const messagePreview = message.text?.substring(0, 50) || "Sent an image";

  for (const recipientId of recipients) {
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
      deepLinkRoute: "Message",
      deepLinkParams: {chatId},
    });

    await sendPushToUser(recipientId, {
      title: displayName,
      body: messagePreview,
      data: {route: "Message", chatId},
    });
  }
});

// ==================== KYC NOTIFICATIONS ====================

/**
 * Send notification when KYC status changes (approved/rejected).
 */
export const onKycUpdated = onDocumentUpdated("kyc/{kycId}", async (event) => {
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
    data: {route: isApproved ? "Feed" : "KycScreen"},
  });
});

// ==================== TRIP JOIN NOTIFICATIONS ====================

/**
 * Send notification when someone joins a trip.
 */
export const onTripJoin = onDocumentUpdated("trips/{tripId}", async (event) => {
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
      deepLinkParams: {tripId},
    });

    await sendPushToUser(after.userId, {
      title: "New Trip Member! 🎒",
      body: `${joiner.displayName || "Someone"} joined your trip to ${after.destination}`,
      data: {route: "TripDetails", tripId},
    });
  }
});

// ==================== NEW USER WELCOME NOTIFICATION ====================

/**
 * Create welcome/KYC reminder notification for new users.
 */
export const onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
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

// ==================== CLEANUP FUNCTIONS ====================

/**
 * Clean up subcollections when a chat is deleted.
 */
export const onChatDeleted = onDocumentDeleted("chats/{chatId}", async (event) => {
  if (!event.data) return;

  const chatId = event.params.chatId;

  // Delete all messages in subcollection
  const messagesSnapshot = await db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .get();

  if (messagesSnapshot.empty) return;

  const batch = db.batch();
  messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`Deleted ${messagesSnapshot.size} messages for chat ${chatId}`);
});
