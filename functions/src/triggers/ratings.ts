import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== RATING & JOIN CONFIRMATION ====================

/**
 * Notify host when a new rating is created.
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

                await createNotification({
                    recipientId: hostId,
                    type: "rating",
                    title: "New Rating ⭐",
                    message: `${raterName} rated "${tripTitle}" ${ratingValue} stars!`,
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
            }
        } catch (e) {
            console.error("Error in onRatingCreated:", e);
        }
    }
);


