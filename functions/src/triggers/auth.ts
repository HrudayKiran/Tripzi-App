
import * as functions from 'firebase-functions/v1';
import { wipeUserData } from '../utils/cleanup';
import { r2AccessKeyId, r2SecretAccessKey } from '../utils/r2';

/**
 * Triggered when a user is deleted from Firebase Auth 
 * (via Console, Admin SDK, or deleteMyAccount).
 * Note: Uses v1 syntax because v2 identity triggers are primarily blocking functions.
 */
export const onUserDeleted = functions
    .runWith({ secrets: [r2AccessKeyId, r2SecretAccessKey] })
    .auth
    .user()
    .onDelete(async (user) => {
    const uid = user.uid;

    console.log(`User deleted ${uid}, commencing data wipe...`);
    await wipeUserData(uid);
    });
