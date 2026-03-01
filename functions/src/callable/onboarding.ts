import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const MINIMUM_AGE = 18;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const normalizeString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const calculateAge = (dateOfBirth: Date, now: Date): number => {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
};

export const checkGoogleUserStatus = onCall(async (request) => {
  const email = normalizeString(request.data?.email).toLowerCase();
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'Valid email is required.');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();
    return {
      existing: userDoc.exists,
      hasAuth: true,
    };
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') {
      return {
        existing: false,
        hasAuth: false,
      };
    }

    throw new HttpsError('internal', 'Failed to check user status.');
  }
});

export const checkUsernameAvailability = onCall(async (request) => {
  const username = normalizeString(request.data?.username).toLowerCase();
  const excludeUid = normalizeString(request.data?.excludeUid) || request.auth?.uid || '';

  if (!USERNAME_REGEX.test(username)) {
    throw new HttpsError('invalid-argument', 'Invalid username format.');
  }

  const snapshot = await admin
    .firestore()
    .collection('users')
    .where('username', '==', username)
    .limit(2)
    .get();

  const takenByOther = snapshot.docs.some((doc) => doc.id !== excludeUid);

  return {
    available: !takenByOther,
  };
});

export const completeOnboarding = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const name = normalizeString(request.data?.name);
  const username = normalizeString(request.data?.username).toLowerCase();
  const gender = normalizeString(request.data?.gender).toLowerCase();
  const dateOfBirthRaw = normalizeString(request.data?.dateOfBirth);
  const bio = normalizeString(request.data?.bio);

  if (!name) {
    throw new HttpsError('invalid-argument', 'Name is required.');
  }
  if (!USERNAME_REGEX.test(username)) {
    throw new HttpsError('invalid-argument', 'Invalid username format.');
  }
  if (gender !== 'male' && gender !== 'female') {
    throw new HttpsError('invalid-argument', 'Gender must be male or female.');
  }
  if (!dateOfBirthRaw) {
    throw new HttpsError('invalid-argument', 'dateOfBirth is required.');
  }

  const dateOfBirth = new Date(dateOfBirthRaw);
  if (Number.isNaN(dateOfBirth.getTime())) {
    throw new HttpsError('invalid-argument', 'Invalid dateOfBirth value.');
  }

  const now = new Date();
  if (dateOfBirth > now) {
    throw new HttpsError('invalid-argument', 'dateOfBirth cannot be in the future.');
  }

  const age = calculateAge(dateOfBirth, now);
  if (age < MINIMUM_AGE) {
    await Promise.all([
      admin.firestore().collection('users').doc(uid).delete().catch(() => {}),
      admin.firestore().collection('public_users').doc(uid).delete().catch(() => {}),
      admin.auth().deleteUser(uid).catch(() => {}),
    ]);

    throw new HttpsError('failed-precondition', 'You must be at least 18 years old.');
  }

  const usersRef = admin.firestore().collection('users');

  const usernameSnapshot = await usersRef.where('username', '==', username).limit(2).get();
  const isTaken = usernameSnapshot.docs.some((doc) => doc.id !== uid);
  if (isTaken) {
    throw new HttpsError('already-exists', 'Username is already taken.');
  }

  const userRecord = await admin.auth().getUser(uid);
  const userRef = usersRef.doc(uid);
  const existingUserDoc = await userRef.get();

  const payload: Record<string, unknown> = {
    userId: uid,
    email: userRecord.email || null,
    name,
    username,
    gender,
    bio: bio || '',
    photoURL: userRecord.photoURL || null,
    ageVerified: true,
    ageVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    dateOfBirth: admin.firestore.Timestamp.fromDate(dateOfBirth),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!existingUserDoc.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  } else {
    payload.displayName = admin.firestore.FieldValue.delete();
  }

  await userRef.set(payload, { merge: true });

  await admin.auth().updateUser(uid, {
    displayName: name,
  });

  return {
    success: true,
    age,
  };
});
