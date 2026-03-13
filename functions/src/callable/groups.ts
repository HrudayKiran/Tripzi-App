import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../utils/firebase";

interface GroupChatData {
  type?: string;
  groupName?: string;
  createdBy?: string;
  participants?: string[];
  admins?: string[];
  memberCount?: number;
}

const toTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const isChatCollection = (value: unknown): value is "chats" | "group_chats" => {
  return value === "chats" || value === "group_chats";
};

const requireAuthUid = (request: any): string => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return uid;
};

const getGroupChat = async (chatId: string, preferredCollection?: "chats" | "group_chats") => {
  const collections: Array<"chats" | "group_chats"> = preferredCollection
    ? [preferredCollection, preferredCollection === "chats" ? "group_chats" : "chats"]
    : ["group_chats", "chats"];

  for (const collectionName of collections) {
    const chatRef = db.collection(collectionName).doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      continue;
    }

    const chatData = chatDoc.data() as GroupChatData;
    if (chatData?.type && chatData.type !== "group") {
      throw new HttpsError("failed-precondition", "Chat is not a group.");
    }

    return { chatRef, chatData, collectionName };
  }

  throw new HttpsError("not-found", "Group chat not found.");
};

const isGroupAdmin = (chatData: GroupChatData, uid: string): boolean => {
  const admins = Array.isArray(chatData.admins) ? chatData.admins : [];
  return chatData.createdBy === uid || admins.includes(uid);
};

const ensureAdmin = (chatData: GroupChatData, uid: string) => {
  if (!isGroupAdmin(chatData, uid)) {
    throw new HttpsError("permission-denied", "Only group admins can perform this action.");
  }
};

const ensureCreator = (chatData: GroupChatData, uid: string) => {
  if (chatData.createdBy !== uid) {
    throw new HttpsError("permission-denied", "Only the group creator can perform this action.");
  }
};

const getUserSummary = async (uid: string) => {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const data = userDoc.data() || {};
  return {
    displayName: data.name || data.displayName || "User",
    photoURL: data.photoURL || "",
  };
};

const addSystemMessage = async (
  chatRef: FirebaseFirestore.DocumentReference,
  text: string
) => {
  await chatRef.collection("messages").add({
    senderId: "system",
    senderName: "System",
    type: "system",
    text,
    status: "sent",
    readBy: {},
    deliveredTo: [],
    deletedFor: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await chatRef.update({
    lastMessage: {
      text,
      senderId: "system",
      senderName: "System",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: "system",
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

export const addGroupMember = onCall(async (request) => {
  const callerUid = requireAuthUid(request);
  const chatId = toTrimmedString(request.data?.chatId);
  const memberId = toTrimmedString(request.data?.memberId);
  const collectionName = isChatCollection(request.data?.collectionName)
    ? request.data.collectionName
    : undefined;

  if (!chatId || !memberId) {
    throw new HttpsError("invalid-argument", "chatId and memberId are required.");
  }

  const { chatRef, chatData } = await getGroupChat(chatId, collectionName);
  ensureAdmin(chatData, callerUid);

  const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
  if (participants.includes(memberId)) {
    return { success: true, skipped: "already_member" };
  }

  const [actor, member] = await Promise.all([
    getUserSummary(callerUid),
    getUserSummary(memberId),
  ]);

  await chatRef.update({
    participants: admin.firestore.FieldValue.arrayUnion(memberId),
    [`participantDetails.${memberId}`]: {
      displayName: member.displayName,
      photoURL: member.photoURL,
      role: "member",
    },
    [`unreadCount.${memberId}`]: 0,
    memberCount: participants.length + 1,
    hidden: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await addSystemMessage(chatRef, `${actor.displayName} added ${member.displayName}`);

  return { success: true };
});

export const removeGroupMember = onCall(async (request) => {
  const callerUid = requireAuthUid(request);
  const chatId = toTrimmedString(request.data?.chatId);
  const memberId = toTrimmedString(request.data?.memberId);
  const collectionName = isChatCollection(request.data?.collectionName)
    ? request.data.collectionName
    : undefined;

  if (!chatId || !memberId) {
    throw new HttpsError("invalid-argument", "chatId and memberId are required.");
  }

  if (callerUid === memberId) {
    throw new HttpsError(
      "failed-precondition",
      "Use leaveGroup to remove yourself from a group."
    );
  }

  const { chatRef, chatData } = await getGroupChat(chatId, collectionName);
  ensureAdmin(chatData, callerUid);

  const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
  if (!participants.includes(memberId)) {
    return { success: true, skipped: "not_member" };
  }

  const [actor, member] = await Promise.all([
    getUserSummary(callerUid),
    getUserSummary(memberId),
  ]);

  await chatRef.update({
    participants: admin.firestore.FieldValue.arrayRemove(memberId),
    admins: admin.firestore.FieldValue.arrayRemove(memberId),
    deletedBy: admin.firestore.FieldValue.arrayRemove(memberId),
    [`participantDetails.${memberId}`]: admin.firestore.FieldValue.delete(),
    [`unreadCount.${memberId}`]: admin.firestore.FieldValue.delete(),
    [`clearedAt.${memberId}`]: admin.firestore.FieldValue.delete(),
    memberCount: Math.max(0, participants.length - 1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await addSystemMessage(chatRef, `${actor.displayName} removed ${member.displayName}`);

  return { success: true };
});

export const promoteGroupAdmin = onCall(async (request) => {
  const callerUid = requireAuthUid(request);
  const chatId = toTrimmedString(request.data?.chatId);
  const memberId = toTrimmedString(request.data?.memberId);
  const collectionName = isChatCollection(request.data?.collectionName)
    ? request.data.collectionName
    : undefined;

  if (!chatId || !memberId) {
    throw new HttpsError("invalid-argument", "chatId and memberId are required.");
  }

  const { chatRef, chatData } = await getGroupChat(chatId, collectionName);
  ensureCreator(chatData, callerUid);

  const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
  if (!participants.includes(memberId)) {
    throw new HttpsError("failed-precondition", "Target user is not a group participant.");
  }

  const [actor, member] = await Promise.all([
    getUserSummary(callerUid),
    getUserSummary(memberId),
  ]);

  await chatRef.update({
    admins: admin.firestore.FieldValue.arrayUnion(memberId),
    [`participantDetails.${memberId}.role`]: "admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await addSystemMessage(chatRef, `${actor.displayName} made ${member.displayName} an admin`);

  return { success: true };
});

export const demoteGroupAdmin = onCall(async (request) => {
  const callerUid = requireAuthUid(request);
  const chatId = toTrimmedString(request.data?.chatId);
  const memberId = toTrimmedString(request.data?.memberId);
  const collectionName = isChatCollection(request.data?.collectionName)
    ? request.data.collectionName
    : undefined;

  if (!chatId || !memberId) {
    throw new HttpsError("invalid-argument", "chatId and memberId are required.");
  }

  const { chatRef, chatData } = await getGroupChat(chatId, collectionName);
  ensureCreator(chatData, callerUid);

  if (memberId === chatData.createdBy) {
    throw new HttpsError("failed-precondition", "Group creator cannot be demoted.");
  }

  const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
  if (!participants.includes(memberId)) {
    throw new HttpsError("failed-precondition", "Target user is not a group participant.");
  }

  const [actor, member] = await Promise.all([
    getUserSummary(callerUid),
    getUserSummary(memberId),
  ]);

  await chatRef.update({
    admins: admin.firestore.FieldValue.arrayRemove(memberId),
    [`participantDetails.${memberId}.role`]: "member",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await addSystemMessage(chatRef, `${actor.displayName} removed ${member.displayName} as admin`);

  return { success: true };
});

export const leaveGroup = onCall(async (request) => {
  const callerUid = requireAuthUid(request);
  const chatId = toTrimmedString(request.data?.chatId);
  const collectionName = isChatCollection(request.data?.collectionName)
    ? request.data.collectionName
    : undefined;

  if (!chatId) {
    throw new HttpsError("invalid-argument", "chatId is required.");
  }

  const { chatRef, chatData } = await getGroupChat(chatId, collectionName);

  if (chatData.createdBy === callerUid) {
    throw new HttpsError(
      "failed-precondition",
      "Group creator cannot leave without transferring ownership."
    );
  }

  const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
  if (!participants.includes(callerUid)) {
    return { success: true, skipped: "not_member" };
  }

  const actor = await getUserSummary(callerUid);

  await chatRef.update({
    participants: admin.firestore.FieldValue.arrayRemove(callerUid),
    admins: admin.firestore.FieldValue.arrayRemove(callerUid),
    deletedBy: admin.firestore.FieldValue.arrayRemove(callerUid),
    [`participantDetails.${callerUid}`]: admin.firestore.FieldValue.delete(),
    [`unreadCount.${callerUid}`]: admin.firestore.FieldValue.delete(),
    [`clearedAt.${callerUid}`]: admin.firestore.FieldValue.delete(),
    memberCount: Math.max(0, participants.length - 1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await addSystemMessage(chatRef, `${actor.displayName} left the group`);

  return { success: true };
});
