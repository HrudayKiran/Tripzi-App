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

    }
};

/**
 * Pre-built notification creators for common events
 */
export const NotificationService = {
    // When someone follows you - Handled by Cloud Function 'onUserFollowed'
    onFollow: async (_followerId: string, _followerName: string, _targetUserId: string) => {
        // await createNotification({...}); 

    },

    // When someone likes your trip - Handled by Cloud Function 'onLikeCreated'
    onLike: async (_likerId: string, _likerName: string, _tripId: string, _tripOwnerId: string, _tripTitle: string) => {
        // await createNotification({...});

    },

    // When someone comments on your trip - Handled by Cloud Function 'onCommentCreated'
    onComment: async (_commenterId: string, _commenterName: string, _tripId: string, _tripOwnerId: string, _tripTitle: string) => {
        // await createNotification({...});

    },

    // When someone joins your trip - Handled by Cloud Function 'onTripJoined'
    onJoinTrip: async (_joinerId: string, _joinerName: string, _tripId: string, _tripOwnerId: string, _tripTitle: string) => {
        // await createNotification({...});

    },

    // When someone leaves your trip - NOT handled by Cloud Function yet
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

    // When someone rates your completed trip - Handled by Cloud Function 'onRatingCreated'
    onTripRating: async (_raterId: string, _raterName: string, _tripId: string, _tripOwnerId: string, _tripTitle: string, _rating: number) => {
        // await createNotification({...});

    },

    // KYC verified - Handled by backend/manual
    onKycVerified: async (userId: string) => {
        await createNotification({
            recipientId: userId,
            type: 'kyc_verified',
            title: 'KYC Verified ✅',
            body: 'Your identity has been verified. You can now create and join trips!',
            data: {},
        });
    },

    // KYC rejected - Handled by backend/manual
    onKycRejected: async (userId: string, reason: string) => {
        await createNotification({
            recipientId: userId,
            type: 'kyc_rejected',
            title: 'KYC Rejected ❌',
            body: `Your KYC was rejected: ${reason}. Please resubmit.`,
            data: { reason },
        });
    },

    // Trip cancelled - Handled by Cloud Function 'onTripDeleted'
    onTripCancelled: async (participantId: string, _tripId: string, _tripTitle: string, _hostName: string) => {
        // await createNotification({...});

    },

    // Chat message (handled by Cloud Functions for FCM) - Handled by Cloud Function 'onMessageCreated'
    onChatMessage: async (_recipientId: string, _senderId: string, _senderName: string, _chatId: string, _preview: string) => {
        // await createNotification({...});

    },

    // Report submitted (notify admins) - Handled by Cloud Function 'onReportCreated'
    onReportSubmitted: async (_reporterId: string, _reportType: string, _targetId: string, _targetTitle: string) => {
        // await createNotification({...});

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

