import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { AppNotification } from '../hooks/useNotifications';

type ValidTarget =
    | { route: string; params?: Record<string, unknown> }
    | null;

const getChatSnapshotIfAccessible = async (
    collection: 'chats' | 'group_chats',
    chatId: string,
    uid: string
) => {
    const snapshot = await firestore().collection(collection).doc(chatId).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() || {};
    const participants = Array.isArray(data.participants) ? data.participants : [];
    return participants.includes(uid) && data.hidden !== true ? snapshot : null;
};

export const resolveNotificationTarget = async (
    notification: Pick<AppNotification, 'deepLinkRoute' | 'deepLinkParams' | 'entityType' | 'entityId'>
): Promise<ValidTarget> => {
    const route = notification.deepLinkRoute;
    const params = notification.deepLinkParams || {};
    const uid = auth().currentUser?.uid;

    if (!route) return null;

    if (route === 'Home' || route === 'MyTrips' || route === 'Settings' || route === 'EditProfile') {
        return { route, params };
    }

    if (route === 'TripDetails') {
        const tripId = String(params.tripId || notification.entityId || '');
        if (!tripId) return null;
        const snapshot = await firestore().collection('trips').doc(tripId).get();
        if (!snapshot.exists) return null;

        const trip = snapshot.data() || {};
        if (trip.deletedAt || trip.status === 'deleted') {
            return null;
        }

        return { route: 'TripDetails', params: { tripId } };
    }

    if (route === 'Chat' || route === 'GroupInfo') {
        if (!uid) return null;
        const chatId = String(params.chatId || notification.entityId || '');
        if (!chatId) return null;

        const directChat = await getChatSnapshotIfAccessible('chats', chatId, uid);
        const groupChat = directChat ? null : await getChatSnapshotIfAccessible('group_chats', chatId, uid);
        const collectionName = directChat ? 'chats' : groupChat ? 'group_chats' : null;
        if (!collectionName) return null;

        return {
            route,
            params: {
                chatId,
                collectionName,
                isGroupChat: collectionName === 'group_chats',
            },
        };
    }

    if (route === 'Profile') {
        const requestedUserId = String(params.userId || notification.entityId || uid || '');
        if (requestedUserId && uid && requestedUserId !== uid) {
            const snapshot = await firestore().collection('public_users').doc(requestedUserId).get();
            return snapshot.exists ? { route: 'UserProfile', params: { userId: requestedUserId } } : null;
        }

        return uid ? { route: 'Profile', params: {} } : null;
    }

    if (route === 'UserProfile') {
        const userId = String(params.userId || notification.entityId || uid || '');
        if (!userId) return null;
        if (uid && userId === uid) {
            return { route: 'Profile', params: {} };
        }
        const snapshot = await firestore().collection('public_users').doc(userId).get();
        return snapshot.exists ? { route: 'UserProfile', params: { userId } } : null;
    }

    if (route === 'ExternalLink') {
        const url = params.url;
        return typeof url === 'string' && url.length > 0 ? { route, params } : null;
    }

    return null;
};
