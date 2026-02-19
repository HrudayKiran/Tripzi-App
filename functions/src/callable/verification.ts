import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const MINIMUM_AGE = 18;

const calculateAge = (dateOfBirth: Date, now: Date): number => {
    let age = now.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = now.getMonth() - dateOfBirth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
        age -= 1;
    }

    return age;
};

/**
 * Server-side age verification write path.
 * Keeps sensitive fields (ageVerified/dateOfBirth) out of direct client writes.
 */
export const verifyMyAge = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const rawDateOfBirth = request.data?.dateOfBirth;
    if (typeof rawDateOfBirth !== 'string') {
        throw new HttpsError('invalid-argument', 'dateOfBirth must be an ISO date string.');
    }

    const dateOfBirth = new Date(rawDateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime())) {
        throw new HttpsError('invalid-argument', 'Invalid dateOfBirth value.');
    }

    const now = new Date();
    if (dateOfBirth > now) {
        throw new HttpsError('invalid-argument', 'dateOfBirth cannot be in the future.');
    }

    const age = calculateAge(dateOfBirth, now);
    if (age < MINIMUM_AGE) {
        throw new HttpsError('failed-precondition', 'You must be at least 18 years old.');
    }

    const userRef = admin.firestore().collection('users').doc(request.auth.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }

    await userRef.update({
        ageVerified: true,
        dateOfBirth: admin.firestore.Timestamp.fromDate(dateOfBirth),
        ageVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
        verified: true,
        age,
    };
});
