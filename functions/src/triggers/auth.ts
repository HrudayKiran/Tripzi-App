
import * as functions from 'firebase-functions/v1';
import { wipeUserData } from '../utils/cleanup';

/**
 * Triggered when a user is deleted from Firebase Auth 
 * (via Console, Admin SDK, or deleteMyAccount).
 * Note: Uses v1 syntax because v2 identity triggers are primarily blocking functions.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;

    console.log(`User deleted ${uid}, commencing data wipe...`);
    await wipeUserData(uid);
});
