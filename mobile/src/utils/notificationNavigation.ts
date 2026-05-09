import { supabase } from '../lib/supabase';
import type { AppNotification } from '../hooks/useNotifications';

type ValidTarget =
    | { route: string; params?: Record<string, unknown> }
    | null;

const getChatIfAccessible = async (
    table: 'chats' | 'group_chats',
    chatId: string,
    uid: string
) => {
    const { data } = await supabase
        .from(table)
        .select('id, participants, hidden')
        .eq('id', chatId)
        .maybeSingle();

    if (!data) return null;
    const participants = Array.isArray(data.participants) ? data.participants : [];
    return participants.includes(uid) && data.hidden !== true ? data : null;
};

export const resolveNotificationTarget = async (
    notification: Pick<AppNotification, 'deepLinkRoute' | 'deepLinkParams' | 'entityType' | 'entityId'>
): Promise<ValidTarget> => {
    const route = notification.deepLinkRoute;
    const params = notification.deepLinkParams || {};

    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;

    if (!route) return null;

    if (route === 'Home' || route === 'MyTrips' || route === 'Settings' || route === 'EditProfile') {
        return { route, params };
    }

    if (route === 'TripDetails') {
        const tripId = String(params.tripId || notification.entityId || '');
        if (!tripId) return null;
        const { data: trip } = await supabase
            .from('trips')
            .select('id, status')
            .eq('id', tripId)
            .maybeSingle();

        if (!trip || trip.status === 'deleted') return null;
        return { route: 'TripDetails', params: { tripId } };
    }

    if (route === 'Chat' || route === 'GroupInfo') {
        if (!uid) return null;
        const chatId = String(params.chatId || notification.entityId || '');
        if (!chatId) return null;

        const directChat = await getChatIfAccessible('chats', chatId, uid);
        const groupChat = directChat ? null : await getChatIfAccessible('group_chats', chatId, uid);
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
            const { data } = await supabase
                .from('public_profiles')
                .select('id')
                .eq('id', requestedUserId)
                .maybeSingle();
            return data ? { route: 'UserProfile', params: { userId: requestedUserId } } : null;
        }
        return uid ? { route: 'Profile', params: {} } : null;
    }

    if (route === 'UserProfile') {
        const userId = String(params.userId || notification.entityId || uid || '');
        if (!userId) return null;
        if (uid && userId === uid) {
            return { route: 'Profile', params: {} };
        }
        const { data } = await supabase
            .from('public_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
        return data ? { route: 'UserProfile', params: { userId } } : null;
    }

    if (route === 'ExternalLink') {
        const url = params.url;
        return typeof url === 'string' && url.length > 0 ? { route, params } : null;
    }

    return null;
};
