/**
 * Script to add createdAt timestamps to existing trips that don't have them.
 * Run this script once to backfill timestamps.
 * 
 * Usage: node --experimental-specifier-resolution=node scripts/fix-trip-timestamps.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin (for local development)
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
        databaseURL: 'https://tripzi-52736816-98c83.firebaseio.com'
    });
} catch (e) {
    console.log('Using default credentials or already initialized');
}

const db = admin.firestore();

async function fixTripTimestamps() {
    console.log('Fetching all trips...');

    const tripsSnapshot = await db.collection('trips').get();
    console.log(`Found ${tripsSnapshot.size} trips`);

    let updatedCount = 0;
    let skippedCount = 0;

    const batch = db.batch();

    for (const doc of tripsSnapshot.docs) {
        const data = doc.data();

        if (!data.createdAt) {
            // Set createdAt to current time for trips without it
            // We could also use the document creation time if available
            batch.update(doc.ref, {
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updatedCount++;
            console.log(`  Will add timestamp to trip: ${doc.id} (${data.title || 'Untitled'})`);
        } else {
            skippedCount++;
        }
    }

    if (updatedCount > 0) {
        console.log(`\nCommitting batch update for ${updatedCount} trips...`);
        await batch.commit();
        console.log('Done!');
    }

    console.log(`\nSummary:`);
    console.log(`  Updated: ${updatedCount} trips`);
    console.log(`  Skipped: ${skippedCount} trips (already had timestamps)`);
}

fixTripTimestamps()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
