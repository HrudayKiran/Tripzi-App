
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';
import * as admin from 'firebase-admin';

// ==================== TRIP NOTIFICATIONS ====================


/**
 * Handle Trip Joins: Create/Update Group Chat & Notify
 */
export const onTripJoin = onDocumentUpdated(
    { document: "trips/{tripId}" },
    async (event) => {
        if (!event.data) return;

        const beforeParticipants = event.data.before.data().participants || [];
        const afterParticipants = event.data.after.data().participants || [];
        const tripId = event.params.tripId;
        const tripData = event.data.after.data();
        const tripTitle = tripData.title || "Trip";
        const hostId = tripData.userId;

        // Find new joiners
        const newJoiners = afterParticipants.filter((uid: string) => !beforeParticipants.includes(uid));

        if (newJoiners.length > 0) {
            console.log(`[JoinTrigger] ${newJoiners.length} user(s) joined trip ${tripId}`);

            // 1. Manage Group Chat
            let chatId: string | null = null;
            let isNewChat = false;

            const chatsQuery = await db.collection('chats')
                .where('tripId', '==', tripId)
                .where('type', '==', 'group')
                .limit(1)
                .get();

            if (!chatsQuery.empty) {
                // Add to existing chat
                const chatDoc = chatsQuery.docs[0];
                chatId = chatDoc.id;
                await chatDoc.ref.update({
                    participants: admin.firestore.FieldValue.arrayUnion(...newJoiners),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`[JoinTrigger] Added joiners to existing chat ${chatId}`);
            } else if (hostId) {
                // Create new chat
                isNewChat = true;
                const newChatRef = db.collection('chats').doc();
                chatId = newChatRef.id;

                await newChatRef.set({
                    tripId,
                    type: 'group',
                    groupName: tripTitle,
                    participants: [hostId, ...newJoiners],
                    createdBy: hostId,
                    tripImage: tripData.coverImage || tripData.images?.[0] || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastMessage: {
                        text: `Group chat created for "${tripTitle}"`,
                        senderId: 'system',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'system',
                    }
                });
                console.log(`[JoinTrigger] Created new group chat ${chatId}`);
            }

            // 2. Notify & Message
            for (const joinerId of newJoiners) {
                const joinerDoc = await db.collection("users").doc(joinerId).get();
                const joinerName = joinerDoc.data()?.displayName || "Someone";

                // A. Specific Notification for Joiner
                await createNotification({
                    recipientId: joinerId,
                    type: "join_success",
                    title: "You're Going! 🎒",
                    message: chatId
                        ? `You joined "${tripTitle}" and were added to the group chat.`
                        : `You successfully joined "${tripTitle}". Pack your bags!`,
                    entityId: tripId,
                    entityType: "trip",
                    deepLinkRoute: "Chat", // Direct to chat if exists, else trip details logic? 
                    // Actually, if chat exists, we might want to deep link to it. 
                    // But for now, let's keep it safe. 
                    // Wait, user asked NOT to navigate to chat on click? 
                    // "when clicked on join it should not go to chat... instead in background..."
                    // This was about the BUTTON click in UI. 
                    // For Notification click, dropping them in Chat is probably good.
                    deepLinkParams: chatId ? { chatId } : { tripId },
                    // If we pass chatId, the app needs to handle it. 
                    // "Chat" route expects { chatId }. 
                    // If no chat, we fall back to TripDetails? 
                    // Let's safe-guard: if chatId exists, route to "Chat", else "TripDetails"
                });

                // Correcting the deepLinkRoute based on chat existence
                if (chatId) {
                    await sendPushToUser(joinerId, {
                        title: "You're Going! 🎒",
                        body: `You joined "${tripTitle}" and were added to the group chat.`,
                        data: { route: "Chat", chatId },
                    });
                } else {
                    await sendPushToUser(joinerId, {
                        title: "You're Going! 🎒",
                        body: `You successfully joined "${tripTitle}". Pack your bags!`,
                        data: { route: "TripDetails", tripId },
                    });
                }

                // B. Notify Host
                if (hostId && hostId !== joinerId) {
                    await createNotification({
                        recipientId: hostId,
                        type: "join_trip",
                        title: "New Traveler 🚗",
                        message: `${joinerName} joined "${tripTitle}" and the group chat.`,
                        entityId: tripId,
                        entityType: "trip",
                        actorId: joinerId,
                        actorName: joinerName,
                        deepLinkRoute: chatId ? "Chat" : "TripDetails",
                        deepLinkParams: chatId ? { chatId } : { tripId },
                    });

                    await sendPushToUser(hostId, {
                        title: "New Traveler 🚗",
                        body: `${joinerName} joined "${tripTitle}"`,
                        data: { route: chatId ? "Chat" : "TripDetails", chatId, tripId },
                    });
                }

                // C. System Message in Chat
                if (chatId) {
                    const systemText = isNewChat
                        ? `Group chat created for "${tripTitle}"`
                        : `${joinerName} joined the trip.`;

                    if (!isNewChat) {
                        await db.collection('chats').doc(chatId).collection('messages').add({
                            text: systemText,
                            senderId: 'system',
                            senderName: 'System',
                            type: 'system',
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }
            }
        }
    }
);

/**
 * Notify participants when a trip is updated (details changed or participant left).
 */
export const onTripUpdated = onDocumentUpdated(
    { document: "trips/{tripId}" },
    async (event) => {
        if (!event.data) return;

        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const tripId = event.params.tripId;
        const hostId = afterData.userId;
        const tripTitle = afterData.title || "Trip";

        // 1. Check for Participant Removal (Leave Trip)
        const beforeParticipants = beforeData.participants || [];
        const afterParticipants = afterData.participants || [];

        // Find who left
        const leftUsers = beforeParticipants.filter((uid: string) => !afterParticipants.includes(uid));

        if (leftUsers.length > 0) {
            for (const leaverId of leftUsers) {
                if (leaverId === hostId) continue;

                const leaverDoc = await db.collection("users").doc(leaverId).get();
                const leaverName = leaverDoc.data()?.displayName || "Someone";

                // Notify Host
                await createNotification({
                    recipientId: hostId,
                    type: "leave_trip",
                    title: "Traveler Left 😔",
                    message: `${leaverName} left your trip "${tripTitle}"`,
                    entityId: tripId,
                    entityType: "trip",
                    actorId: leaverId,
                    actorName: leaverName,
                    deepLinkRoute: "TripDetails",
                    deepLinkParams: { tripId },
                });

                await sendPushToUser(hostId, {
                    title: "Traveler Left 😔",
                    body: `${leaverName} left your trip "${tripTitle}"`,
                    data: { route: "TripDetails", tripId },
                });
            }
        }

        // 2. Check for Critical Detail Updates
        // Skip if it was just a participant change or like

        const isDifferent = (a: any, b: any) => {
            // Treat undefined and null as equal
            if ((a === undefined || a === null) && (b === undefined || b === null)) return false;
            // Compare stringified for objects/arrays, strict for primitives
            if (typeof a === 'object' || typeof b === 'object') {
                return JSON.stringify(a) !== JSON.stringify(b);
            }
            return a !== b;
        };

        const isTitleChanged = isDifferent(beforeData.title, afterData.title);
        const isDestinationChanged = isDifferent(beforeData.destination, afterData.destination);
        const isDescriptionChanged = isDifferent(beforeData.description, afterData.description);

        // Handle potential Timestamp objects or strings for dates
        const getTs = (d: any) => d?.toMillis ? d.toMillis() : (d?.seconds ? d.seconds * 1000 : new Date(d).getTime());
        const beforeStart = getTs(beforeData.startDate);
        const afterStart = getTs(afterData.startDate);
        // Special date check: if both invalid/missing, equal.
        const isStartDateChanged = (beforeStart || 0) !== (afterStart || 0);

        const beforeEnd = getTs(beforeData.endDate);
        const afterEnd = getTs(afterData.endDate);
        const isEndDateChanged = (beforeEnd || 0) !== (afterEnd || 0);

        const isPriceChanged = isDifferent(beforeData.price, afterData.price);

        const isDetailUpdate =
            isTitleChanged ||
            isDestinationChanged ||
            isDescriptionChanged ||
            isStartDateChanged ||
            isEndDateChanged ||
            isPriceChanged;

        if (isDetailUpdate) {
            const changes: string[] = [];
            if (isTitleChanged) changes.push("Title");
            if (isDestinationChanged) changes.push("Destination");
            if (isDescriptionChanged) changes.push("Description");
            if (isStartDateChanged || isEndDateChanged) changes.push("Dates");
            if (isPriceChanged) changes.push("Price");

            const updateMessage = changes.length > 0
                ? `Host updated: ${changes.join(", ")}`
                : `Host updated details for "${tripTitle}"`;

            const recipients = afterParticipants.filter((uid: string) => uid !== hostId);
            console.log(`[TripUpdate] Sending notifications to ${recipients.length} recipients: ${recipients}`);

            for (const recipientId of recipients) {
                await createNotification({
                    recipientId,
                    type: "trip_update",
                    title: "Trip Updated 📝",
                    message: updateMessage,
                    entityId: tripId,
                    entityType: "trip",
                    deepLinkRoute: "TripDetails",
                    deepLinkParams: { tripId },
                });

                await sendPushToUser(recipientId, {
                    title: "Trip Updated 📝",
                    body: updateMessage,
                    data: { route: "TripDetails", tripId },
                });
            }
        }
    }
);



/**
 * Notify participants when a trip is DELETED (Cancelled) by the host.
 */
export const onTripDeleted = onDocumentDeleted(
    { document: "trips/{tripId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const tripData = snapshot.data();
        const hostId = tripData.userId;
        const tripTitle = tripData.title || "Trip";
        const participants = tripData.participants || [];

        const recipients = participants.filter((uid: string) => uid !== hostId);

        for (const recipientId of recipients) {
            await createNotification({
                recipientId,
                type: "trip_cancelled",
                title: "Trip Cancelled ❌",
                message: `The trip "${tripTitle}" has been cancelled by the host.`,
                entityId: event.params.tripId,
                entityType: "trip",
                deepLinkRoute: "CreateTrip", // Fallback
            });

            await sendPushToUser(recipientId, {
                title: "Trip Cancelled ❌",
                body: `The trip "${tripTitle}" has been cancelled by the host.`,
                data: { route: "Home" },
            });
        }
    }
);
