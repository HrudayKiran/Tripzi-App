
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';



// ==================== ACCOUNT MANAGEMENT ====================

/**
 * Callable function to delete the current user's account.
 * Deletes Firestore data and Firebase Auth account.
 */
export const deleteMyAccount = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = request.auth.uid;

    try {
        console.log(`Requesting account deletion for user: ${uid}`);

        // Deleting the user from Auth will trigger 'onUserDeleted' 
        // which handles all the Firestore and Storage cleanup.
        await admin.auth().deleteUser(uid);

        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting account for ${uid}:`, error);
        throw new HttpsError('internal', error.message || 'Failed to delete account.');
    }
});
