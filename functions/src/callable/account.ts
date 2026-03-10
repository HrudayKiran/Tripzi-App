
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';



// ==================== ACCOUNT MANAGEMENT ====================

/**
 * Callable function to delete the current user's account.
 * Stores user details + reason in `deleted_users` collection,
 * then deletes Firebase Auth account (which triggers onUserDeleted for cleanup).
 */
export const deleteMyAccount = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = request.auth.uid;
    const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim() : '';

    try {
        console.log(`Requesting account deletion for user: ${uid}`);

        // 1. Fetch user data before deletion to preserve in deleted_users
        const db = admin.firestore();
        let userData: Record<string, unknown> = {};
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                userData = userDoc.data() || {};
            }
        } catch (e) {
            console.warn(`Could not fetch user data for ${uid} before deletion:`, e);
        }

        // 2. Get auth record for email/provider info
        let authEmail: string | undefined;
        let authProviders: string[] = [];
        try {
            const authRecord = await admin.auth().getUser(uid);
            authEmail = authRecord.email;
            authProviders = authRecord.providerData.map(p => p.providerId);
        } catch (e) {
            console.warn(`Could not fetch auth record for ${uid}:`, e);
        }

        // 3. Store in deleted_users collection
        await db.collection('deleted_users').doc(uid).set({
            userId: uid,
            email: authEmail || userData.email || null,
            name: userData.name || userData.displayName || null,
            username: userData.username || null,
            gender: userData.gender || null,
            reason: reason || 'No reason provided',
            providers: authProviders,
            originalCreatedAt: userData.createdAt || null,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Stored deleted user record for ${uid}`);

        // 4. Deleting the user from Auth will trigger 'onUserDeleted' 
        // which handles all the Firestore and Storage cleanup.
        await admin.auth().deleteUser(uid);

        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting account for ${uid}:`, error);
        throw new HttpsError('internal', error.message || 'Failed to delete account.');
    }
});
