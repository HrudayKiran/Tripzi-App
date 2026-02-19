/**
 * Backfill script: normalizes trip schema toward canonical fields:
 * - toLocation (from location/destination fallbacks)
 * - fromDate / toDate (from startDate/endDate fallbacks)
 * - cost (from costPerPerson/totalCost/price fallbacks)
 *
 * Usage:
 * 1. Auth options:
 *    - Put service account JSON at: scripts/service-account.json
 *    - OR set GOOGLE_APPLICATION_CREDENTIALS for ADC
 * 2. Dry run (default):
 *    node scripts/backfill_trip_schema_fields.js
 * 3. Apply writes:
 *    set DRY_RUN=false && node scripts/backfill_trip_schema_fields.js
 */

const { admin } = require('./_admin_init');

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN !== 'false';

const firstDefined = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null) return value;
    }
    return null;
};

const toNumberOrNull = (value) => {
    if (value === undefined || value === null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

async function backfillTrips() {
    console.log(`[TripBackfill] Starting (DRY_RUN=${DRY_RUN})`);

    const tripsSnapshot = await db.collection('trips').get();
    let scanned = 0;
    let updated = 0;

    for (const tripDoc of tripsSnapshot.docs) {
        scanned++;
        const trip = tripDoc.data();
        const updatePayload = {};

        const canonicalToLocation = firstDefined(trip.toLocation, trip.location, trip.destination);
        if (canonicalToLocation && trip.toLocation !== canonicalToLocation) {
            updatePayload.toLocation = canonicalToLocation;
        }
        if (canonicalToLocation && trip.location !== canonicalToLocation) {
            updatePayload.location = canonicalToLocation;
        }

        const canonicalFromDate = firstDefined(trip.fromDate, trip.startDate);
        if (canonicalFromDate && !trip.fromDate) {
            updatePayload.fromDate = canonicalFromDate;
        }

        const canonicalToDate = firstDefined(trip.toDate, trip.endDate);
        if (canonicalToDate && !trip.toDate) {
            updatePayload.toDate = canonicalToDate;
        }

        const canonicalCost = firstDefined(trip.cost, trip.costPerPerson, trip.totalCost, trip.price);
        const numericCost = toNumberOrNull(canonicalCost);
        if (numericCost !== null) {
            if (trip.cost !== numericCost) updatePayload.cost = numericCost;
            if (trip.costPerPerson !== numericCost) updatePayload.costPerPerson = numericCost;
            if (trip.totalCost !== numericCost) updatePayload.totalCost = numericCost;
        }

        if (Object.keys(updatePayload).length === 0) continue;

        if (DRY_RUN) {
            console.log(`[DryRun] Would update trips/${tripDoc.id}:`, updatePayload);
        } else {
            await tripDoc.ref.update(updatePayload);
            updated++;
        }
    }

    console.log('[TripBackfill] Done');
    console.log(`[TripBackfill] Scanned: ${scanned}`);
    console.log(`[TripBackfill] Updated: ${updated}`);
}

backfillTrips().catch((error) => {
    console.error('[TripBackfill] Failed:', error);
    process.exit(1);
});
