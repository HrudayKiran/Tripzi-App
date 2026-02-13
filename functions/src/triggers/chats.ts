
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== CHAT NOTIFICATIONS ====================

/**
 * Notify recipients when a new message is created in a chat.
 */
export const onMessageCreated = onDocumentCreated(
    { document: "chats/{chatId}/messages/{messageId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const messageData = snapshot.data();
        const chatId = event.params.chatId;
        const senderId = messageData.senderId;
        const text = messageData.text;
        const type = messageData.type; // 'text', 'image', etc.

        // Get Chat Metadata (participants)
        const chatDoc = await db.collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return;

        const chatData = chatDoc.data();
        const participants = chatData?.participants || [];

        // Determine title/body based on chat type (Group vs DM)
        const isGroup = chatData?.type === 'group';
        const groupName = chatData?.groupName || "Group Chat";

        // Get Sender Name
        let senderName = "Someone";
        if (senderId === 'system') {
            senderName = "Tripzi";
        } else {
            const senderDoc = await db.collection("users").doc(senderId).get();
            senderName = senderDoc.data()?.displayName || "Someone";
        }

        // Check for Mentions
        const mentions: string[] = messageData.mentions || [];
        const isEveryoneMentioned = mentions.includes('everyone');

        // Determine notification content
        const notificationTitle = isGroup ? groupName : senderName;
        let notificationBody = isGroup
            ? (senderId === 'system' ? text : `${senderName}: ${type === 'image' ? '📷 Image' : text}`)
            : (type === 'image' ? 'Sent an image 📷' : text);

        if (isEveryoneMentioned) {
            notificationBody = `${senderName} mentioned everyone: ${text}`;
        }

        const recipients = participants.filter((uid: string) => uid !== senderId);

        for (const recipientId of recipients) {
            // Customize body for specific mentions
            let userBody = notificationBody;
            let userTitle = notificationTitle;

            if (!isEveryoneMentioned && mentions.includes(recipientId)) {
                userBody = `${senderName} mentioned you: ${text}`;
            }

            await createNotification({
                recipientId,
                type: "message",
                title: userTitle,
                message: userBody,
                entityId: chatId,
                entityType: "chat", // or "message"
                actorId: senderId,
                actorName: senderName,
                deepLinkRoute: "Chat",
                deepLinkParams: { chatId },
            });

            await sendPushToUser(recipientId, {
                title: userTitle,
                body: userBody,
                data: { route: "Chat", chatId },
            });
        }
    }
);
