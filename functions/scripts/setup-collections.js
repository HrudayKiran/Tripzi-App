/**
 * Script to set up Priya Sharma's account in Firestore.
 * Creates users and trips collections with her real data.
 * 
 * Usage: node scripts/setup-collections.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

// Prevent multiple initializations (helpful if require is cached or multiple calls)
if (!admin.apps.length) {
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || 'tripzi-52736816-98c83',
            storageBucket: 'tripzi-52736816-98c83.appspot.com',
            databaseURL: `https://${serviceAccount.project_id || 'tripzi-52736816-98c83'}.firebaseio.com`
        });
        console.log(`Initialized Firebase Admin for project: ${serviceAccount.project_id || 'tripzi-52736816-98c83'}`);
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e.message);
        process.exit(1);
    }
}

const db = admin.firestore();
// Use preferRest to avoid gRPC issues on Windows
db.settings({
    ignoreUndefinedProperties: true,
    preferRest: true  // Use REST API instead of gRPC for better Windows compatibility
});
const storage = admin.storage();

// Users to setup
const USERS = [
    {
        userId: 'Cehiv5h2CRTazQC7Dp9BVoGMPe13',
        displayName: 'Priya Sharma',
        email: 'testuser@tripzi.app',
        username: 'priyasharma',
        bio: 'Travel enthusiast | Photographer 📸',
    },
    {
        userId: 'V5YLZpt4rOXeyJeDoVTpNxnxMnz2',
        displayName: 'Kiran Reddy',
        email: 'webbusinesswithkiran@gmail.com',
        username: 'kiranreddy',
        bio: 'Admin Account',
        role: 'admin', // Grants admin privileges in Firestore Rules
    }
];

// NOTE: Ideally, we should fetch the UID by email to get the REAL Auth ID.
async function getUserIdByEmail(email) {
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        return userRecord.uid;
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`   ⚠️ User ${email} not found in Auth. Creating placeholder ID.`);
            return null; // or create a random one, but better to warn
        }
        console.error(`   Error fetching user by email ${email}:`, error.message);
        return null;
    }
}

/**
 * Manually delete all data for a user (collections + storage).
 * Mirrors the Cloud Function logic.
 */
async function deleteUserData(userId) {
    if (!userId) return;
    console.log(`\nStarting CLEANUP for user: ${userId}...`);

    const batch = db.batch();
    let deleteCount = 0;

    try {
        // 1. Delete user's trips
        const tripsSnapshot = await db.collection("trips").where("userId", "==", userId).get();
        for (const doc of tripsSnapshot.docs) {
            const commentsSnapshot = await doc.ref.collection("comments").get();
            for (const comment of commentsSnapshot.docs) {
                batch.delete(comment.ref);
                deleteCount++;
            }
            batch.delete(doc.ref);
            deleteCount++;
        }

        // 2. Delete push_tokens
        const pushTokenRef = db.collection("push_tokens").doc(userId);
        batch.delete(pushTokenRef);
        deleteCount++;

        // 3. Remove from chats
        const chatsSnapshot = await db.collection("chats").where("participants", "array-contains", userId).get();
        for (const chatDoc of chatsSnapshot.docs) {
            const chatData = chatDoc.data();
            const participants = chatData.participants || [];
            if (participants.length <= 1) {
                batch.delete(chatDoc.ref);
                deleteCount++;
            } else {
                batch.update(chatDoc.ref, {
                    participants: admin.firestore.FieldValue.arrayRemove(userId)
                });
            }
        }

        // 4. Delete Storage
        const bucket = storage.bucket();
        await bucket.deleteFiles({ prefix: `profiles/${userId}/` }).catch(() => { });
        await bucket.deleteFiles({ prefix: `trips/${userId}/` }).catch(() => { });

        // 5. Delete User Doc
        const userRef = db.collection("users").doc(userId);
        batch.delete(userRef);
        deleteCount++;

        if (deleteCount > 0) await batch.commit();
        console.log(`   ✓ Cleanup complete. Removed/Updated ${deleteCount} docs & storage files.`);

    } catch (error) {
        console.error(`   ❌ Error during cleanup for ${userId}:`, error.message);
    }
}

async function setupAccount(userData, shouldClean = false) {
    console.log(`\nProcessing account for ${userData.email}...`);

    let uid = userData.userId;
    const realUid = await getUserIdByEmail(userData.email);
    if (realUid) {
        uid = realUid;
        console.log(`   ✓ Found real UID: ${uid}`);
    } else {
        console.log(`   ⚠️ Using placeholder ID: ${uid}`);
    }

    if (shouldClean) {
        await deleteUserData(uid);
    }

    console.log(`   -> Setting up account data...`);

    try {
        // Create/update user document (Auto-Deploy Logic)
        await db.collection('users').doc(uid).set({
            displayName: userData.displayName,
            email: userData.email,
            photoURL: null,
            kycStatus: 'verified',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            followers: [],
            following: [],
            bio: userData.bio || '',
            username: userData.username,
            role: userData.role || 'user',
        }, { merge: true });
        console.log(`      ✓ Users collection updated.`);

        // Setup push_tokens
        await db.collection('push_tokens').doc(uid).set({
            tokens: {},
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`      ✓ Push tokens document ready.`);

        // Create Storage Placeholders (to ensure folders are visible in Console)
        // Storage prefixes (folders) only exist if there are files in them.
        const bucket = storage.bucket();
        const profilePlaceholder = bucket.file(`profiles/${uid}/placeholder.txt`);
        const tripPlaceholder = bucket.file(`trips/${uid}/placeholder.txt`);

        await profilePlaceholder.save('Placeholder for profile images', { contentType: 'text/plain' });
        await tripPlaceholder.save('Placeholder for trip images', { contentType: 'text/plain' });

        console.log(`      ✓ Storage folders created: profiles/${uid}/, trips/${uid}/`);

    } catch (error) {
        console.error(`   ❌ Error setting up ${userData.email}:`, error.message);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean') || args.includes('--reset');

    console.log('Starting Setup Script...');
    if (shouldClean) {
        console.log('⚠️  --clean mode detected: Creating fresh state by deleting old data first.');
    }

    try {
        for (const user of USERS) {
            await setupAccount(user, shouldClean);
        }

        console.log('\n========================================');
        console.log('✅ Operation complete!');
        console.log('========================================');
    } catch (error) {
        console.error('\n❌ Fatal Error in main loop:', error.message);
        if (error.code === 5) {
            console.log('\n⚠️  Database connection issue. Check:');
            console.log('   - serviceAccountKey.json contains the correct project_id');
            console.log('   - admin.initializeApp project_id matches the Firestore database');
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Unhandled Rejection:', err);
        process.exit(1);
    });
