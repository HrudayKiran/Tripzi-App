import { supabase } from '../lib/supabase';
import type { AppNotification } from '../hooks/useNotifications';

type ValidTarget =
    | { route: string; params?: Record<string, unknown> }
    | null;

const getChatIfAccessible = async (
    table: 'chats',
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

    if (route === 'Home') return { route: '/(tabs)/', params };
    if (route === 'MyTrips') return { route: '/trip/my-trips', params };
    if (route === 'Settings') return { route: '/profile/settings', params };
    if (route === 'EditProfile') return { route: '/profile/edit', params };

    if (route === 'TripDetails') {
        const tripId = String(params.tripId || notification.entityId || '');
        if (!tripId) return null;
        const { data: trip } = await supabase
            .from('trips')
            .select('id, status')
            .eq('id', tripId)
            .maybeSingle();

        if (!trip || trip.status === 'deleted') return null;
        return { route: '/trip/[id]', params: { id: tripId } };
    }

    if (route === 'Chat' || route === 'GroupInfo') {
        if (!uid) return null;
        const chatId = String(params.chatId || notification.entityId || '');
        if (!chatId) return null;

        const chat = await getChatIfAccessible('chats', chatId, uid);
        if (!chat) return null;

        return {
            route: route === 'GroupInfo' ? '/chat/info' : '/chat/[id]',
            params: {
                id: chatId,
                chatId,
                collectionName: 'chats',
                isGroupChat: 'false',
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
            return data ? { route: '/profile/[id]', params: { id: requestedUserId } } : null;
        }
        return uid ? { route: '/(tabs)/profile', params: {} } : null;
    }

    if (route === 'UserProfile') {
        const userId = String(params.userId || notification.entityId || uid || '');
        if (!userId) return null;
        if (uid && userId === uid) {
            return { route: '/(tabs)/profile', params: {} };
        }
        const { data } = await supabase
            .from('public_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
        return data ? { route: '/profile/[id]', params: { id: userId } } : null;
    }

    if (route === 'ExternalLink') {
        const url = params.url;
        return typeof url === 'string' && url.length > 0 ? { route, params } : null;
    }

    return null;
};;
