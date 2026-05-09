import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';

const groups = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const getPublicName = async (sb: any, uid: string) => {
  const { data } = await sb.from('public_profiles').select('display_name').eq('id', uid).maybeSingle();
  return data?.display_name || 'User';
};

const addSystemMessage = async (sb: any, chatId: string, table: string, text: string) => {
  await sb.from('messages').insert({ chat_id: table === 'group_chats' ? null : chatId, group_chat_id: table === 'group_chats' ? chatId : null, sender_id: null, sender_name: 'System', type: 'system', text, status: 'sent' });
  await sb.from(table).update({ last_message_text: text, last_message_sender_id: null, last_message_at: new Date().toISOString() }).eq('id', chatId);
};

groups.post('/add-member', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Group not found.' }, 404);

  const admins = chat.admins || [];
  if (chat.created_by !== callerUid && !admins.includes(callerUid)) return c.json({ error: 'Only admins can add members.' }, 403);

  const participants = chat.participants || [];
  if (participants.includes(memberId)) return c.json({ success: true, skipped: 'already_member' });

  const [actorName, memberName] = await Promise.all([getPublicName(sb, callerUid), getPublicName(sb, memberId)]);

  await sb.from('group_chats').update({ participants: [...participants, memberId], member_count: participants.length + 1 }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'group_chats', `${actorName} added ${memberName}`);
  return c.json({ success: true });
});

groups.post('/remove-member', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  if (callerUid === memberId) return c.json({ error: 'Use leave endpoint.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Group not found.' }, 404);

  const admins = chat.admins || [];
  if (chat.created_by !== callerUid && !admins.includes(callerUid)) return c.json({ error: 'Only admins.' }, 403);

  const participants = chat.participants || [];
  if (!participants.includes(memberId)) return c.json({ success: true, skipped: 'not_member' });

  const [actorName, memberName] = await Promise.all([getPublicName(sb, callerUid), getPublicName(sb, memberId)]);
  const newParticipants = participants.filter((p: string) => p !== memberId);
  const newAdmins = (admins as string[]).filter((a: string) => a !== memberId);

  await sb.from('group_chats').update({ participants: newParticipants, admins: newAdmins, member_count: newParticipants.length }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'group_chats', `${actorName} removed ${memberName}`);
  return c.json({ success: true });
});

groups.post('/promote-admin', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Group not found.' }, 404);
  if (chat.created_by !== callerUid) return c.json({ error: 'Only creator can promote.' }, 403);

  const participants = chat.participants || [];
  if (!participants.includes(memberId)) return c.json({ error: 'Not a participant.' }, 400);

  const admins = chat.admins || [];
  if (!admins.includes(memberId)) admins.push(memberId);

  const [actorName, memberName] = await Promise.all([getPublicName(sb, callerUid), getPublicName(sb, memberId)]);
  await sb.from('group_chats').update({ admins }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'group_chats', `${actorName} made ${memberName} an admin`);
  return c.json({ success: true });
});

groups.post('/demote-admin', async (c) => {
  const callerUid = c.get('userId');
  const { chatId, memberId } = await c.req.json<{ chatId?: string; memberId?: string }>();
  if (!chatId || !memberId) return c.json({ error: 'chatId and memberId required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Group not found.' }, 404);
  if (chat.created_by !== callerUid) return c.json({ error: 'Only creator can demote.' }, 403);
  if (memberId === chat.created_by) return c.json({ error: 'Creator cannot be demoted.' }, 400);

  const admins = (chat.admins || []).filter((a: string) => a !== memberId);
  const [actorName, memberName] = await Promise.all([getPublicName(sb, callerUid), getPublicName(sb, memberId)]);
  await sb.from('group_chats').update({ admins }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'group_chats', `${actorName} removed ${memberName} as admin`);
  return c.json({ success: true });
});

groups.post('/leave', async (c) => {
  const callerUid = c.get('userId');
  const { chatId } = await c.req.json<{ chatId?: string }>();
  if (!chatId) return c.json({ error: 'chatId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: chat } = await sb.from('group_chats').select('*').eq('id', chatId).maybeSingle();
  if (!chat) return c.json({ error: 'Group not found.' }, 404);
  if (chat.created_by === callerUid) return c.json({ error: 'Creator cannot leave without transferring ownership.' }, 400);

  const participants = chat.participants || [];
  if (!participants.includes(callerUid)) return c.json({ success: true, skipped: 'not_member' });

  const actorName = await getPublicName(sb, callerUid);
  const newParticipants = participants.filter((p: string) => p !== callerUid);
  const newAdmins = (chat.admins || []).filter((a: string) => a !== callerUid);

  await sb.from('group_chats').update({ participants: newParticipants, admins: newAdmins, member_count: newParticipants.length }).eq('id', chatId);
  await addSystemMessage(sb, chatId, 'group_chats', `${actorName} left the group`);
  return c.json({ success: true });
});

export default groups;
