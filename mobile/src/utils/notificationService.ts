/**
 * Notification Service Utility
 * Centralized notification creation for all app events
 */

import firestore from '@react-native-firebase/firestore';

export type NotificationType =
    | 'follow'
    | 'like'
    | 'comment'
    | 'join_trip'
    | 'leave_trip'
    | 'trip_rating'
    | 'kyc_verified'
    | 'kyc_rejected'
    | 'chat_message'
    | 'trip_cancelled'
    | 'trip_report'
    | 'trip_update'
    | 'system';

export interface NotificationData {
    tripId?: string;
    chatId?: string;
    userId?: string;
    messageId?: string;
    rating?: number;
    reason?: string;
}

interface CreateNotificationParams {
    recipientId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: NotificationData;
    senderId?: string;
}

/**
 * Creates an in-app notification in Firestore
 * Cloud Functions will handle sending FCM push notifications
 */
export const createNotification = async ({
    recipientId,
    type,
    title,
    body,
    data = {},
    senderId,
}: CreateNotificationParams): Promise<void> => {
    try {
        // Don't send notification to yourself
        if (senderId && senderId === recipientId) {
            return;
        }

        await firestore()
            .collection('notifications')
            .doc(recipientId)
            .collection('items')
            .add({
                type,
                title,
                body,
                data,
                senderId: senderId || null,
                read: false,
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

/**
 * Pre-built notification creators for common events
 */
export const NotificationService = {
    // When someone follows you
    onFollow: async (followerId: string, followerName: string, targetUserId: string) => {
        await createNotification({
            recipientId: targetUserId,
            type: 'follow',
            title: 'New Follower',
            body: `${followerName} started following you`,
            data: { userId: followerId },
            senderId: followerId,
        });
    },

    // When someone likes your trip
    onLike: async (likerId: string, likerName: string, tripId: string, tripOwnerId: string, tripTitle: string) => {
        await createNotification({
            recipientId: tripOwnerId,
            type: 'like',
            title: 'New Like ❤️',
            body: `${likerName} liked your trip "${tripTitle}"`,
            data: { tripId, userId: likerId },
            senderId: likerId,
        });
    },

    // When someone comments on your trip
    onComment: async (commenterId: string, commenterName: string, tripId: string, tripOwnerId: string, tripTitle: string) => {
        await createNotification({
            recipientId: tripOwnerId,
            type: 'comment',
            title: 'New Comment 💬',
            body: `${commenterName} commented on "${tripTitle}"`,
            data: { tripId, userId: commenterId },
            senderId: commenterId,
        });
    },

    // When someone joins your trip
    onJoinTrip: async (joinerId: string, joinerName: string, tripId: string, tripOwnerId: string, tripTitle: string) => {
        await createNotification({
            recipientId: tripOwnerId,
            type: 'join_trip',
            title: 'New Traveler! 🎒',
            body: `${joinerName} joined your trip "${tripTitle}"`,
            data: { tripId, userId: joinerId },
            senderId: joinerId,
        });
    },

    // When someone leaves your trip
    onLeaveTrip: async (leaverId: string, leaverName: string, tripId: string, tripOwnerId: string, tripTitle: string) => {
        await createNotification({
            recipientId: tripOwnerId,
            type: 'leave_trip',
            title: 'Traveler Left',
            body: `${leaverName} left your trip "${tripTitle}"`,
            data: { tripId, userId: leaverId },
            senderId: leaverId,
        });
    },

    // When someone rates your completed trip
    onTripRating: async (raterId: string, raterName: string, tripId: string, tripOwnerId: string, tripTitle: string, rating: number) => {
        await createNotification({
            recipientId: tripOwnerId,
            type: 'trip_rating',
            title: 'New Rating ⭐',
            body: `${raterName} rated "${tripTitle}" ${rating} stars`,
            data: { tripId, userId: raterId, rating },
            senderId: raterId,
        });
    },

    // KYC verified
    onKycVerified: async (userId: string) => {
        await createNotification({
            recipientId: userId,
            type: 'kyc_verified',
            title: 'KYC Verified ✅',
            body: 'Your identity has been verified. You can now create and join trips!',
            data: {},
        });
    },

    // KYC rejected
    onKycRejected: async (userId: string, reason: string) => {
        await createNotification({
            recipientId: userId,
            type: 'kyc_rejected',
            title: 'KYC Rejected ❌',
            body: `Your KYC was rejected: ${reason}. Please resubmit.`,
            data: { reason },
        });
    },

    // Trip cancelled
    onTripCancelled: async (participantId: string, tripId: string, tripTitle: string, hostName: string) => {
        await createNotification({
            recipientId: participantId,
            type: 'trip_cancelled',
            title: 'Trip Cancelled ⚠️',
            body: `"${tripTitle}" by ${hostName} has been cancelled`,
            data: { tripId },
        });
    },

    // Chat message (handled by Cloud Functions for FCM)
    onChatMessage: async (recipientId: string, senderId: string, senderName: string, chatId: string, preview: string) => {
        await createNotification({
            recipientId,
            type: 'chat_message',
            title: senderName,
            body: preview.length > 50 ? preview.substring(0, 50) + '...' : preview,
            data: { chatId, userId: senderId },
            senderId,
        });
    },

    // Report submitted (notify admins)
    onReportSubmitted: async (reporterId: string, reportType: string, targetId: string, targetTitle: string) => {
        try {
            const adminsSnapshot = await firestore()
                .collection('users')
                .where('role', '==', 'admin')
                .get();

            for (const adminDoc of adminsSnapshot.docs) {
                await createNotification({
                    recipientId: adminDoc.id,
                    type: 'system',
                    title: '🚨 New Report',
                    body: `${reportType} report on "${targetTitle}"`,
                    data: {},
                    senderId: reporterId,
                });
            }
        } catch { }
    },

    // Report status update (notify reporter)
    onReportStatusUpdate: async (reporterId: string, status: 'investigating' | 'resolved' | 'dismissed', reportType: string) => {
        const statusMessages = {
            investigating: 'Your report is being investigated',
            resolved: 'Your report has been resolved. Thank you for helping keep Tripzi safe!',
            dismissed: 'Your report was reviewed but no action was taken',
        };

        await createNotification({
            recipientId: reporterId,
            type: 'trip_report',
            title: `Report ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: statusMessages[status],
            data: {},
        });
    },

    // App update notification
    onAppUpdate: async (userId: string, version: string) => {
        await createNotification({
            recipientId: userId,
            type: 'system',
            title: '🎉 Update Available',
            body: `Tripzi ${version} is now available with new features!`,
            data: {},
        });
    },
};

export default NotificationService;

