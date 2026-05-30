import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { createNotification, sendPushToUser } from '../lib/notifications';

const groupChats = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const getProfile = async (sb: any, uid: string) => {
  const { data } = await sb.from('public_profiles').select('*').eq('id', uid).maybeSingle();
  return data;
};

const addSystemMessage = async (sb: any, chatId: string, table: string, text: string) => {
  await sb.from('messages').insert({ 
    chat_id: chatId, 
    sender_id: null, 
    sender_name: 'System', 
    type: 'system', 
    text, 
    status: 'sent' 
  });
  
  await sb.from('group_chats').update({ 
    last_message: {
      text,
      sender_id: null,
      created_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  }).eq('id', chatId);
};

groupChats.post('/add-member', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Chat not found.' }, 404);

  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  if (participants.includes(memberId)) return c.json({ success: true, skipped: 'already_member' });

  const [actor, member] = await Promise.all([getProfile(sb, callerUid), getProfile(sb, memberId)]);

  await sb.from('group_chats').update({ 
    participants: [...participants, memberId], 
    member_count: participants.length + 1 
  }).eq('id', chatId);

  await addSystemMessage(sb, chatId, 'chats', `${actor?.display_name || 'Admin'} added ${member?.display_name || 'someone'}`);

  const notifPayload = {
    recipientId: memberId,
    type: 'system',
    title: 'Added to Group',
    message: `You were added to the group "${chat.group_name || 'Itinerary'}" by ${actor?.display_name || 'an admin'}`,
    entityId: chatId,
    entityType: 'chat',
    actorId: callerUid,
    actorName: actor?.display_name,
    deepLinkRoute: 'ChatRoom',
    deepLinkParams: { chatId, type: 'group' }
  };
  await createNotification(sb, notifPayload);
  await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, memberId, {
    title: notifPayload.title,
    body: notifPayload.message,
    data: { screen: 'ChatRoom', chatId, type: 'group' }
  });

  return c.json({ success: true });
});

groupChats.post('/remove-member', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  if (callerUid === memberId) return c.json({ error: 'Use leave endpoint.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Chat not found.' }, 404);

  // Note: For now we allow creator to remove, but we should check if caller is creator or participant
  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  if (!participants.includes(memberId)) return c.json({ success: true, skipped: 'not_member' });

  const [actor, member] = await Promise.all([getProfile(sb, callerUid), getProfile(sb, memberId)]);
  const newParticipants = participants.filter((p: string) => p !== memberId);

  await sb.from('group_chats').update({ 
    participants: newParticipants, 
    member_count: newParticipants.length 
  }).eq('id', chatId);

  await addSystemMessage(sb, chatId, 'chats', `${actor?.display_name || 'Admin'} removed ${member?.display_name || 'someone'}`);
  
  const notifPayload = {
    recipientId: memberId,
    type: 'system',
    title: 'Removed from Group',
    message: `You were removed from the group "${chat.group_name || 'Itinerary'}"`,
    entityId: chatId,
    entityType: 'chat',
    actorId: callerUid,
    actorName: actor?.display_name,
    deepLinkRoute: 'ChatList',
    deepLinkParams: {}
  };
  await createNotification(sb, notifPayload);
  await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, memberId, {
    title: notifPayload.title,
    body: notifPayload.message,
    data: { screen: 'ChatList' }
  });

  return c.json({ success: true });
});

groupChats.post('/leave', async (c) => {
  const callerUid = c.get('userId');
  const { chatId } = await c.req.json<{ chatId?: string }>();
  if (!chatId) return c.json({ error: 'chatId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Chat not found.' }, 404);
  if (chat.created_by === callerUid) return c.json({ error: 'Creator cannot leave without transferring ownership.' }, 400);

  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  if (!participants.includes(callerUid)) return c.json({ success: true, skipped: 'not_member' });

  const actor = await getProfile(sb, callerUid);
  const newParticipants = participants.filter((p: string) => p !== callerUid);

  await sb.from('group_chats').update({ 
    participants: newParticipants, 
    member_count: newParticipants.length 
  }).eq('id', chatId);

  await addSystemMessage(sb, chatId, 'chats', `${actor?.display_name || 'User'} left the group`);
  return c.json({ success: true });
});

groupChats.post('/promote-admin', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Chat not found.' }, 404);
  if (chat.created_by !== callerUid) return c.json({ error: 'Only creator can promote.' }, 403);

  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  if (!participants.includes(memberId)) return c.json({ error: 'Not a participant.' }, 400);

  const admins = Array.isArray(chat.admins) ? chat.admins : [];
  if (!admins.includes(memberId)) admins.push(memberId);

  const [actor, member] = await Promise.all([getProfile(sb, callerUid), getProfile(sb, memberId)]);
  await sb.from('group_chats').update({ admins }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'chats', `${actor?.display_name || 'Admin'} made ${member?.display_name || 'someone'} an admin`);
  
  const notifPayload = {
    recipientId: memberId,
    type: 'system',
    title: 'Promoted to Admin',
    message: `You are now an admin of the group "${chat.group_name || 'Itinerary'}"`,
    entityId: chatId,
    entityType: 'chat',
    actorId: callerUid,
    actorName: actor?.display_name,
    deepLinkRoute: 'ChatRoom',
    deepLinkParams: { chatId, type: 'group' }
  };
  await createNotification(sb, notifPayload);
  await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, memberId, {
    title: notifPayload.title,
    body: notifPayload.message,
    data: { screen: 'ChatRoom', chatId, type: 'group' }
  });

  return c.json({ success: true });
});

export default groupChats;
