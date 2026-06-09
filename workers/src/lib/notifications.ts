import { SupabaseClient } from '@supabase/supabase-js';

interface NotificationPayload {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  deepLinkRoute?: string;
  deepLinkParams?: any;
  actorId?: string;
  actorName?: string;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string; // Android notification channel
}

export const createNotification = async (
  supabase: SupabaseClient,
  payload: NotificationPayload
) => {
  try {
    const { recipientId, ...data } = payload;

    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      type: data.type,
      title: data.title,
      message: data.message,
      entity_id: data.entityId || null,
      entity_type: data.entityType || null,
      deep_link_route: data.deepLinkRoute || null,
      deep_link_params: data.deepLinkParams || null,
      actor_id: data.actorId || null,
      actor_name: data.actorName || null,
      is_read: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const sendPushToUser = async (
  supabase: SupabaseClient,
  firebaseServiceAccountJson: string,
  userId: string,
  payload: PushPayload
) => {
  try {
    // Get user's push tokens from Supabase
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) {
      return;
    }

    // Send via FCM HTTP v1 API
    const serviceAccount = JSON.parse(firebaseServiceAccountJson);
    const accessToken = await getFirebaseAccessToken(serviceAccount);

    const projectId = serviceAccount.project_id;

    for (const tokenRow of tokens) {
      try {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: tokenRow.token,
                notification: {
                  title: payload.title,
                  body: payload.body,
                },
                android: {
                  priority: 'high',
                  notification: {
                    channel_id: payload.channelId || 'chat_messages',
                    sound: 'default',
                  },
                },
                data: payload.data || {},
              },
            }),
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`FCM send failed (${response.status}):`, errBody);

          // Clean up invalid/expired tokens
          if (response.status === 404 || errBody.includes('UNREGISTERED')) {
            await supabase.from('push_tokens').delete().eq('token', tokenRow.token);
          }
        }
      } catch (e) {
        console.error(`FCM send error for token:`, e);
      }
    }
  } catch (error) {
    console.error('Error sending push:', error);
  }
};

/**
 * Get a short-lived OAuth2 access token for FCM HTTP v1 API
 * using a service account key (JWT assertion flow).
 */
async function getFirebaseAccessToken(
  serviceAccount: { client_email: string; private_key: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const unsignedToken = `${encode(header)}.${encode(claimSet)}`;

  // Import private key for signing
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedToken}`,
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
