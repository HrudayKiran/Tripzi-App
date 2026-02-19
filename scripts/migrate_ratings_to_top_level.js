/**
 * Backfill script: moves legacy ratings from `trips/{tripId}/ratings/*`
 * into canonical `ratings/*`.
 *
 * Usage:
 * 1. Auth options:
 *    - Put service account JSON at: scripts/service-account.json
 *    - OR set GOOGLE_APPLICATION_CREDENTIALS for ADC
 * 2. Dry run (default):
 *    node scripts/migrate_ratings_to_top_level.js
 * 3. Apply writes:
 *    set DRY_RUN=false && node scripts/migrate_ratings_to_top_level.js
 */

const { admin } = require('./_admin_init');

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN !== 'false';

const buildRatingDocId = (tripId, ratingData, legacyId) => {
    const userId = ratingData.userId || ratingData.raterId;
    if (userId) return `${tripId}_${userId}`;
    return `${tripId}_${legacyId}`;
};

async function migrateRatings() {
    console.log(`[RatingsMigration] Starting (DRY_RUN=${DRY_RUN})`);

    const tripsSnapshot = await db.collection('trips').get();
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;

    for (const tripDoc of tripsSnapshot.docs) {
        const tripId = tripDoc.id;
        const tripData = tripDoc.data();
        const ratingsSnapshot = await tripDoc.ref.collection('ratings').get();

        if (ratingsSnapshot.empty) continue;

        for (const ratingDoc of ratingsSnapshot.docs) {
            scanned++;
            const legacy = ratingDoc.data();
            const userId = legacy.userId || legacy.raterId || null;
            const ratingId = buildRatingDocId(tripId, legacy, ratingDoc.id);
            const targetRef = db.collection('ratings').doc(ratingId);
            const existing = await targetRef.get();

            if (existing.exists) {
                skipped++;
                continue;
            }

            const canonicalData = {
                ...legacy,
                tripId,
                userId,
                hostId: legacy.hostId || tripData.userId || null,
                tripTitle: legacy.tripTitle || tripData.title || 'Trip',
                migratedFrom: ratingDoc.ref.path,
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (DRY_RUN) {
                console.log(`[DryRun] Would migrate ${ratingDoc.ref.path} -> ratings/${ratingId}`);
            } else {
                await targetRef.set(canonicalData, { merge: true });
                migrated++;
            }
        }
    }

    console.log('[RatingsMigration] Done');
    console.log(`[RatingsMigration] Scanned: ${scanned}`);
    console.log(`[RatingsMigration] Migrated: ${migrated}`);
    console.log(`[RatingsMigration] Skipped (already exists): ${skipped}`);
}

migrateRatings().catch((error) => {
    console.error('[RatingsMigration] Failed:', error);
    process.exit(1);
});
