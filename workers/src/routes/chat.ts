/**
 * Chat Notification Routes
 *
 * POST /chat/send-notification — Send push notification to chat participants after a new message
 */

import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { sendPushToUser } from '../lib/notifications';

const chatNotifications = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

/**
 * POST /chat/send-notification
 * Body: { chatId: string, chatType: 'direct' | 'group', senderName: string, messagePreview: string }
 *
 * Called by the client after successfully inserting a message into Supabase.
 * Looks up the chat participants and sends a push notification to each (except sender).
 */
chatNotifications.post('/send-notification', async (c) => {
  const senderId = c.get('userId');
  const body = await c.req.json<{
    chatId?: string;
    chatType?: 'direct' | 'group';
    senderName?: string;
    messagePreview?: string;
  }>();

  const { chatId, chatType, senderName, messagePreview } = body;

  if (!chatId || !chatType) {
    return c.json({ error: 'chatId and chatType are required.' }, 400);
  }

  const sb = getSupabaseAdmin(c.env);
  const table = chatType === 'group' ? 'group_chats' : 'direct_chats';

  // Fetch chat participants
  const { data: chat, error: chatError } = await sb
    .from(table)
    .select('participants, group_name')
    .eq('id', chatId)
    .maybeSingle();

  if (chatError || !chat) {
    return c.json({ error: 'Chat not found.' }, 404);
  }

  const participants: string[] = Array.isArray(chat.participants) ? chat.participants : [];
  const recipients = participants.filter((uid: string) => uid !== senderId);

  if (recipients.length === 0) {
    return c.json({ success: true, pushed: 0 });
  }

  // Build notification content
  const displayName = senderName || 'Someone';
  const preview = messagePreview
    ? (messagePreview.length > 100 ? messagePreview.substring(0, 100) + '…' : messagePreview)
    : 'Sent a message';

  const title = chatType === 'group'
    ? `${displayName} in ${chat.group_name || 'Group'}`
    : displayName;

  const deepLinkParams = JSON.stringify({
    id: chatId,
    chatId,
    isGroupChat: String(chatType === 'group'),
    collectionName: table,
  });

  // Send push to each recipient (fire-and-forget, don't block response)
  let pushCount = 0;
  const pushPromises = recipients.map(async (recipientId: string) => {
    try {
      await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, recipientId, {
        title,
        body: preview,
        data: {
          deepLinkRoute: '/chat/[id]',
          deepLinkParams: deepLinkParams,
          channelId: 'chat_messages',
        },
        channelId: 'chat_messages',
      });
      pushCount++;
    } catch (e) {
      // Don't fail the response if push fails for one recipient
      console.error(`[ChatNotify] Failed to push to ${recipientId}:`, e);
    }
  });

  // Use waitUntil so push sending doesn't delay the HTTP response
  c.executionCtx.waitUntil(Promise.all(pushPromises));

  return c.json({ success: true, pushed: recipients.length });
});

export default chatNotifications;
