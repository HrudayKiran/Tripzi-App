
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== CHAT NOTIFICATIONS ====================

/**
 * Shared handler for message notifications — works for both chats and group_chats.
 */
const handleNewMessage = async (
    chatId: string,
    messageData: any,
    collectionName: 'chats' | 'group_chats'
) => {
    const senderId = messageData.senderId;
    const text = messageData.text || '';
    const type = messageData.type;

    const chatDoc = await db.collection(collectionName).doc(chatId).get();
    if (!chatDoc.exists) return;

    const chatData = chatDoc.data();
    const participants = chatData?.participants || [];
    const isGroup = collectionName === 'group_chats';
    const groupName = chatData?.groupName || "Group Chat";

    let senderName = "Someone";
    if (senderId === 'system') {
        senderName = "Tripzi";
    } else {
        const senderDoc = await db.collection("users").doc(senderId).get();
        senderName = senderDoc.data()?.name || senderDoc.data()?.displayName || "Someone";
    }

    const mentions: string[] = messageData.mentions || [];
    const isEveryoneMentioned = mentions.includes('everyone');

    const notificationTitle = isGroup ? groupName : senderName;
    let notificationBody = '';
    if (isGroup) {
        if (senderId === 'system') {
            notificationBody = text;
        } else {
            switch (type) {
                case 'image': notificationBody = `${senderName}: 📷 Photo`; break;
                case 'location': notificationBody = `${senderName}: 📍 Location`; break;
                case 'voice': notificationBody = `${senderName}: 🎤 Voice message`; break;
                default: notificationBody = `${senderName}: ${text}`;
            }
        }
    } else {
        switch (type) {
            case 'image': notificationBody = 'Sent a photo 📷'; break;
            case 'location': notificationBody = 'Shared a location 📍'; break;
            case 'voice': notificationBody = 'Sent a voice message 🎤'; break;
            default: notificationBody = text;
        }
    }

    if (isEveryoneMentioned) {
        notificationBody = `${senderName} mentioned everyone: ${text}`;
    }

    const recipients = participants.filter((uid: string) => uid !== senderId);

    await Promise.all(recipients.map(async (recipientId: string) => {
        let userBody = notificationBody;
        const userTitle = notificationTitle;

        if (!isEveryoneMentioned && mentions.includes(recipientId)) {
            userBody = `${senderName} mentioned you: ${text}`;
        }

        await createNotification({
            recipientId,
            type: "message",
            title: userTitle,
            message: userBody,
            entityId: chatId,
            entityType: isGroup ? "group_chat" : "chat",
            actorId: senderId,
            actorName: senderName,
            deepLinkRoute: "Chat",
            deepLinkParams: { chatId, isGroupChat: isGroup, collectionName },
        });

        await sendPushToUser(recipientId, {
            title: userTitle,
            body: userBody,
            data: { route: "Chat", chatId, isGroupChat: String(isGroup), collectionName },
        });
    }));
};

/**
 * Direct chat messages
 */
export const onMessageCreated = onDocumentCreated(
    { document: "chats/{chatId}/messages/{messageId}" },
    async (event) => {
        if (!event.data) return;
        await handleNewMessage(event.params.chatId, event.data.data(), 'chats');
    }
);

/**
 * Group chat messages
 */
export const onGroupMessageCreated = onDocumentCreated(
    { document: "group_chats/{chatId}/messages/{messageId}" },
    async (event) => {
        if (!event.data) return;
        await handleNewMessage(event.params.chatId, event.data.data(), 'group_chats');
    }
);
