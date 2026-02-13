
import { db, messaging } from './firebase';
import * as admin from 'firebase-admin';

interface NotificationPayload {
    recipientId: string;
    type: string;
    title: string;
    message: string; // or body
    entityId?: string;
    entityType?: string;
    deepLinkRoute?: string;
    deepLinkParams?: any;
    actorId?: string;
    actorName?: string;
    [key: string]: any;
}

interface PushPayload {
    title: string;
    body: string;
    data?: any;
}

export const createNotification = async (payload: NotificationPayload) => {
    try {
        const { recipientId, ...data } = payload;

        // Deduplication Logic
        // check if a similar notification exists from the same actor for the same entity
        if (['join_trip', 'leave_trip'].includes(data.type)) {
            const recentSnapshot = await db.collection('notifications')
                .doc(recipientId)
                .collection('items')
                .where('type', '==', data.type)
                .where('entityId', '==', data.entityId || '')
                .where('actorId', '==', data.actorId || '')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (!recentSnapshot.empty) {
                const doc = recentSnapshot.docs[0];
                const lastCreated = doc.data().createdAt?.toDate();
                // If created less than 1 minute ago, skip (reduced from 1 hour for testing)
                if (lastCreated && (Date.now() - lastCreated.getTime() < 60000)) {
                    console.log(`Skipping duplicate ${data.type} notification for ${recipientId}`);
                    return;
                }
            }
        }

        await db.collection('notifications').doc(recipientId).collection('items').add({
            ...data,
            body: data.message, // Ensure backward compatibility if 'message' used
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

export const sendPushToUser = async (userId: string, payload: PushPayload) => {
    try {
        console.log(`[Push] Preparing to send push to ${userId}`);
        const tokenDoc = await db.collection('push_tokens').doc(userId).get();
        if (!tokenDoc.exists) {
            console.log(`[Push] No push tokens found for ${userId}`);
            return;
        }

        const tokensMap = tokenDoc.data()?.tokens || {};
        const allTokens = Object.values(tokensMap).map((t: any) => t.token);

        // Filter out undefined/null/empty tokens
        const tokens = allTokens.filter((t: any) => t && typeof t === 'string' && t.length > 0);

        if (tokens.length === 0) {
            console.log(`[Push] Token list is empty for ${userId} (Original count: ${allTokens.length})`);
            return;
        }

        console.log(`[Push] Found ${tokens.length} valid tokens. Sending...`);

        // Filter valid tokens if needed (e.g. check platform)

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`[Push] Send success count: ${response.successCount}, failure count: ${response.failureCount}`);

        if (response.failureCount > 0) {
            console.log(`[Push] Failed to send ${response.failureCount} pushes`);

            const tokensToRemove: string[] = [];

            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    console.error(`[Push] Failure details for token ${idx}:`, error);

                    // Check for invalid/expired tokens
                    if (error?.code === 'messaging/registration-token-not-registered' ||
                        error?.code === 'messaging/invalid-registration-token') {
                        const badToken = tokens[idx]; // tokens array used in message
                        if (badToken) {
                            console.log(`[Push] Marking invalid token for removal: ${badToken}`);
                            tokensToRemove.push(badToken);
                        }
                    }
                }
            });

            // Cleanup invalid tokens
            if (tokensToRemove.length > 0) {
                console.log(`[Push] Removing ${tokensToRemove.length} invalid tokens for user ${userId}`);
                await db.collection('push_tokens').doc(userId).update({
                    tokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove.map(t => ({
                        token: t,
                        // Note: arrayRemove needs exact object match if we store objects. 
                        // If we can't match the exact object (missing platform/timestamp), 
                        // we might need to fetch-filter-update instead.
                    })))
                }).catch(async () => {
                    // Fallback: Fetch, filter, and set back
                    console.log(`[Push] arrayRemove failed (schema mismatch?), falling back to read-modify-write`);
                    const doc = await db.collection('push_tokens').doc(userId).get();
                    if (doc.exists) {
                        const currentTokens = doc.data()?.tokens || {}; // Map or Array?
                        // Based on code above: "Object.values(tokensMap).map..." implies it's a Map (Object)
                        // If it's a Map: { "push_token_string": { token: "...", platform: "..." } }

                        const updates: any = {};
                        // Find keys that match the bad tokens
                        Object.entries(currentTokens).forEach(([key, val]: [string, any]) => {
                            if (tokensToRemove.includes(val.token)) {
                                updates[`tokens.${key}`] = admin.firestore.FieldValue.delete();
                            }
                        });

                        if (Object.keys(updates).length > 0) {
                            await db.collection('push_tokens').doc(userId).update(updates);
                            console.log(`[Push] Successfully removed invalid tokens via map update`);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error sending push:', error);
    }
};
