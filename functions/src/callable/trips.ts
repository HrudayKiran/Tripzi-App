import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

const normalizeString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const timestampToDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }
  if (typeof (value as {toDate?: () => Date}).toDate === 'function') {
    return (value as {toDate: () => Date}).toDate();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTripRef = (tripId: string) => db.collection('trips').doc(tripId);

const getUserProfile = async (uid: string) => {
  const snapshot = await db.collection('users').doc(uid).get();
  if (!snapshot.exists) {
    throw new HttpsError('failed-precondition', 'Complete your profile before using trips.');
  }
  return snapshot.data() || {};
};

export const joinTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tripId = normalizeString(request.data?.tripId);

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!tripId) {
    throw new HttpsError('invalid-argument', 'tripId is required.');
  }

  const userProfile = await getUserProfile(uid);

  await db.runTransaction(async (transaction) => {
    const tripRef = getTripRef(tripId);
    const tripSnapshot = await transaction.get(tripRef);
    if (!tripSnapshot.exists) {
      throw new HttpsError('not-found', 'This trip is no longer available.');
    }

    const trip = tripSnapshot.data() || {};
    const hostId = trip.userId;
    const participants = Array.isArray(trip.participants) ? [...trip.participants] : [];
    const maxTravelers = typeof trip.maxTravelers === 'number' ? trip.maxTravelers : 10;
    const currentTravelers = participants.length;
    const startDate = timestampToDate(trip.fromDate || trip.startDate);
    const genderPreference = normalizeString(trip.genderPreference).toLowerCase();
    const userGender = normalizeString(userProfile.gender).toLowerCase();

    if (hostId === uid) {
      throw new HttpsError('failed-precondition', 'You are the host of this trip.');
    }
    if (trip.status === 'cancelled' || trip.isCancelled === true) {
      throw new HttpsError('failed-precondition', 'This trip has been cancelled.');
    }
    if (trip.isCompleted === true) {
      throw new HttpsError('failed-precondition', 'This trip has already ended.');
    }
    if (startDate && startDate.getTime() <= Date.now()) {
      throw new HttpsError('failed-precondition', 'This trip has already started.');
    }
    if (participants.includes(uid)) {
      return;
    }
    if (currentTravelers >= maxTravelers) {
      throw new HttpsError('failed-precondition', 'This trip is already full.');
    }
    if (!userGender) {
      throw new HttpsError(
        'failed-precondition',
        'Complete your profile gender to join gender-restricted trips.'
      );
    }
    if (genderPreference && genderPreference !== 'anyone' && genderPreference !== userGender) {
      const requiredLabel = genderPreference === 'male' ? 'male' : 'female';
      throw new HttpsError(
        'failed-precondition',
        `This trip is for ${requiredLabel} travelers only.`
      );
    }

    transaction.update(tripRef, {
      participants: [...participants, uid],
      currentTravelers: currentTravelers + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

export const leaveTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tripId = normalizeString(request.data?.tripId);
  const reason = normalizeString(request.data?.reason);

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!tripId) {
    throw new HttpsError('invalid-argument', 'tripId is required.');
  }
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A leave reason is required.');
  }

  await db.runTransaction(async (transaction) => {
    const tripRef = getTripRef(tripId);
    const tripSnapshot = await transaction.get(tripRef);
    if (!tripSnapshot.exists) {
      throw new HttpsError('not-found', 'This trip is no longer available.');
    }

    const trip = tripSnapshot.data() || {};
    const hostId = trip.userId;
    const participants = Array.isArray(trip.participants) ? [...trip.participants] : [];

    if (hostId === uid) {
      throw new HttpsError('failed-precondition', 'Hosts cannot leave their own trip.');
    }
    if (!participants.includes(uid)) {
      throw new HttpsError('failed-precondition', 'You are not part of this trip.');
    }

    const remainingParticipants = participants.filter((participantId: string) => participantId !== uid);

    transaction.update(tripRef, {
      participants: remainingParticipants,
      currentTravelers: remainingParticipants.length,
      lastLeaveReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

export const cancelTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tripId = normalizeString(request.data?.tripId);
  const reason = normalizeString(request.data?.reason);

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!tripId) {
    throw new HttpsError('invalid-argument', 'tripId is required.');
  }
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A cancellation reason is required.');
  }

  const tripRef = getTripRef(tripId);
  const tripSnapshot = await tripRef.get();
  if (!tripSnapshot.exists) {
    throw new HttpsError('not-found', 'This trip is no longer available.');
  }

  const trip = tripSnapshot.data() || {};
  if (trip.userId !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can cancel this trip.');
  }

  const participants = Array.isArray(trip.participants) ? trip.participants : [];
  const recipients = participants.filter((participantId: string) => participantId !== uid);
  const tripTitle = normalizeString(trip.title) || 'Trip';

  await tripRef.update({
    status: 'cancelled',
    isCancelled: true,
    cancelReason: reason,
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const groupChats = await db.collection('group_chats').where('tripId', '==', tripId).get();
  const batch = db.batch();
  groupChats.docs.forEach((doc) => {
    batch.update(doc.ref, {
      hidden: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  if (!groupChats.empty) {
    await batch.commit();
  }

  await Promise.all(recipients.map(async (recipientId: string) => {
    await createNotification({
      recipientId,
      type: 'trip_cancelled',
      title: 'Trip Cancelled',
      message: `The host cancelled "${tripTitle}". Reason: "${reason}"`,
      entityId: tripId,
      entityType: 'trip',
      deepLinkRoute: 'MyTrips',
      deepLinkParams: { initialTab: 'Cancelled' },
    });
    await sendPushToUser(recipientId, {
      title: 'Trip Cancelled',
      body: `The host cancelled "${tripTitle}".`,
      data: { route: 'MyTrips', initialTab: 'Cancelled' },
    });
  }));

  return { success: true };
});

export const deleteTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tripId = normalizeString(request.data?.tripId);
  const reason = normalizeString(request.data?.reason);

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!tripId) {
    throw new HttpsError('invalid-argument', 'tripId is required.');
  }
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A deletion reason is required.');
  }

  const tripRef = getTripRef(tripId);
  const tripSnapshot = await tripRef.get();
  if (!tripSnapshot.exists) {
    throw new HttpsError('not-found', 'This trip is no longer available.');
  }

  const trip = tripSnapshot.data() || {};
  if (trip.userId !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can delete this trip.');
  }

  await tripRef.update({
    deleteReason: reason,
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await tripRef.delete();

  return { success: true };
});

export const rateTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tripId = normalizeString(request.data?.tripId);
  const feedback = normalizeString(request.data?.feedback);
  const rating = Number(request.data?.rating);

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!tripId) {
    throw new HttpsError('invalid-argument', 'tripId is required.');
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new HttpsError('invalid-argument', 'Rating must be between 1 and 5.');
  }

  const tripSnapshot = await getTripRef(tripId).get();
  if (!tripSnapshot.exists) {
    throw new HttpsError('not-found', 'This trip is no longer available.');
  }

  const trip = tripSnapshot.data() || {};
  const hostId = trip.userId;
  const participants = Array.isArray(trip.participants) ? trip.participants : [];
  const endDate = timestampToDate(trip.toDate || trip.endDate);

  if (hostId === uid) {
    throw new HttpsError('failed-precondition', 'Hosts cannot rate their own trips.');
  }
  if (!participants.includes(uid)) {
    throw new HttpsError('permission-denied', 'Only joined travelers can rate this trip.');
  }
  if (endDate && endDate.getTime() > Date.now() && trip.isCompleted !== true) {
    throw new HttpsError('failed-precondition', 'You can rate a trip only after it ends.');
  }

  const currentUser = await admin.auth().getUser(uid);
  const userProfile = await getUserProfile(uid);

  const existingRatingSnapshot = await db
    .collection('ratings')
    .where('tripId', '==', tripId)
    .where('userId', '==', uid)
    .limit(1)
    .get();

  if (existingRatingSnapshot.empty) {
    await db.collection('ratings').add({
      tripId,
      tripTitle: trip.title || 'Trip',
      userId: uid,
      userName: userProfile.name || currentUser.displayName || 'Traveler',
      userPhoto: userProfile.photoURL || currentUser.photoURL || '',
      hostId,
      rating,
      feedback,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await existingRatingSnapshot.docs[0].ref.update({
      rating,
      feedback,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true };
});
