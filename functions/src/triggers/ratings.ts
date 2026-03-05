import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== RATING & JOIN CONFIRMATION ====================

/**
 * Notify host when a new rating is created.
 * Also recalculates the host's average rating.
 */
export const onRatingCreated = onDocumentCreated(
    { document: "ratings/{ratingId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const ratingData = snapshot.data();
        const tripId = ratingData.tripId;
        const raterId = ratingData.userId;
        const ratingValue = ratingData.rating;
        const feedback = ratingData.feedback || '';

        if (!tripId || !raterId) return;

        try {
            const tripDoc = await db.collection("trips").doc(tripId).get();
            if (!tripDoc.exists) return;

            const tripData = tripDoc.data();
            const hostId = tripData?.userId;
            const tripTitle = tripData?.title || "Trip";

            if (hostId && hostId !== raterId) {
                const raterDoc = await db.collection("users").doc(raterId).get();
                const raterName = raterDoc.data()?.name || raterDoc.data()?.displayName || "Someone";

                const feedbackText = feedback ? ` Feedback: "${feedback}"` : '';

                await createNotification({
                    recipientId: hostId,
                    type: "rating",
                    title: "New Rating ⭐",
                    message: `${raterName} rated "${tripTitle}" ${ratingValue} stars!${feedbackText}`,
                    entityId: tripId,
                    entityType: "trip",
                    actorId: raterId,
                    actorName: raterName,
                    deepLinkRoute: "TripDetails",
                    deepLinkParams: { tripId },
                });

                await sendPushToUser(hostId, {
                    title: "New Rating ⭐",
                    body: `${raterName} rated "${tripTitle}" ${ratingValue} stars!`,
                    data: { route: "TripDetails", tripId },
                });

                // ==================== RECALCULATE HOST AVG RATING ====================
                try {
                    // Get all trips by this host
                    const hostTripsSnap = await db.collection('trips')
                        .where('userId', '==', hostId)
                        .select()  // Only need IDs
                        .get();

                    const hostTripIds = hostTripsSnap.docs.map(d => d.id);

                    if (hostTripIds.length > 0) {
                        // Query ratings for all host's trips (in chunks of 10)
                        const allRatings: number[] = [];
                        const chunks = [];
                        for (let i = 0; i < hostTripIds.length; i += 10) {
                            chunks.push(hostTripIds.slice(i, i + 10));
                        }

                        await Promise.all(chunks.map(async (chunk) => {
                            const ratingsSnap = await db.collection('ratings')
                                .where('tripId', 'in', chunk)
                                .get();
                            ratingsSnap.docs.forEach(d => {
                                const r = d.data().rating;
                                if (typeof r === 'number' && r > 0) {
                                    allRatings.push(r);
                                }
                            });
                        }));

                        if (allRatings.length > 0) {
                            const avgRating = Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10;
                            const totalRatings = allRatings.length;

                            // Update user profiles
                            const batch = db.batch();
                            batch.update(db.collection('users').doc(hostId), { avgRating, totalRatings });
                            batch.set(db.collection('public_users').doc(hostId), { avgRating, totalRatings }, { merge: true });
                            await batch.commit();

                            console.log(`[Rating] Updated host ${hostId} avg: ${avgRating} (${totalRatings} ratings)`);
                        }
                    }
                } catch (aggError) {
                    console.error('[Rating] Error aggregating ratings:', aggError);
                }
            }
        } catch (e) {
            console.error("Error in onRatingCreated:", e);
        }
    }
);
