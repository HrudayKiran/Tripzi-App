
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';
import * as admin from 'firebase-admin';

// ==================== TRIP NOTIFICATIONS ====================

const firstDefined = (...values: any[]): any => {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return null;
};

const getComparableTimestamp = (value: any): number | null => {
    if (value === undefined || value === null) return null;

    if (typeof value.toMillis === 'function') {
        return value.toMillis();
    }

    if (typeof value.seconds === 'number') {
        return value.seconds * 1000;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};


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
            await Promise.all(newJoiners.map(async (joinerId: string) => {
                const joinerDoc = await db.collection("users").doc(joinerId).get();
                const joinerName = joinerDoc.data()?.name || joinerDoc.data()?.displayName || "Someone";

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
                    deepLinkRoute: chatId ? "Chat" : "TripDetails",
                    deepLinkParams: chatId ? { chatId } : { tripId },
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
            }));
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
            await Promise.all(leftUsers.map(async (leaverId: string) => {
                if (leaverId === hostId) return;

                const leaverDoc = await db.collection("users").doc(leaverId).get();
                const leaverName = leaverDoc.data()?.name || leaverDoc.data()?.displayName || "Someone";

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
            }));
        }

        // 2. Check for Critical Detail Updates

        const isDifferent = (a: any, b: any) => {
            // Treat undefined and null as equal
            if ((a === undefined || a === null) && (b === undefined || b === null)) return false;
            // Compare stringified for objects/arrays, strict for primitives
            if (typeof a === 'object' || typeof b === 'object') {
                return JSON.stringify(a) !== JSON.stringify(b);
            }
            return a !== b;
        };

        const beforeDestination = firstDefined(beforeData.toLocation, beforeData.location, beforeData.destination);
        const afterDestination = firstDefined(afterData.toLocation, afterData.location, afterData.destination);

        const beforeCost = firstDefined(beforeData.cost, beforeData.costPerPerson, beforeData.totalCost, beforeData.price);
        const afterCost = firstDefined(afterData.cost, afterData.costPerPerson, afterData.totalCost, afterData.price);

        const beforeStartDate = firstDefined(beforeData.fromDate, beforeData.startDate);
        const afterStartDate = firstDefined(afterData.fromDate, afterData.startDate);

        const beforeEndDate = firstDefined(beforeData.toDate, beforeData.endDate);
        const afterEndDate = firstDefined(afterData.toDate, afterData.endDate);

        const isTitleChanged = isDifferent(beforeData.title, afterData.title);
        const isDestinationChanged = isDifferent(beforeDestination, afterDestination);
        const isDescriptionChanged = isDifferent(beforeData.description, afterData.description);
        const isStartDateChanged = getComparableTimestamp(beforeStartDate) !== getComparableTimestamp(afterStartDate);
        const isEndDateChanged = getComparableTimestamp(beforeEndDate) !== getComparableTimestamp(afterEndDate);
        const isPriceChanged = isDifferent(beforeCost, afterCost);

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

            await Promise.all(recipients.map(async (recipientId: string) => {
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
            }));
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

        await Promise.all(recipients.map(async (recipientId: string) => {
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
        }));
    }
);
