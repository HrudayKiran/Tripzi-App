import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';
import * as admin from 'firebase-admin';

// ==================== DAILY TRIP LIFECYCLE SCHEDULER ====================
// Runs once daily at 8:00 AM IST (2:30 AM UTC)

export const dailyTripLifecycle = onSchedule(
    {
        schedule: '30 2 * * *',  // 2:30 AM UTC = 8:00 AM IST
        timeZone: 'Asia/Kolkata',
        retryCount: 1,
    },
    async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        console.log(`[Scheduler] Running daily trip lifecycle at ${now.toISOString()}`);

        // ==================== 1. TRIP START NOTIFICATIONS ====================
        try {
            const startingTrips = await db.collection('trips')
                .where('fromDate', '>=', admin.firestore.Timestamp.fromDate(todayStart))
                .where('fromDate', '<=', admin.firestore.Timestamp.fromDate(todayEnd))
                .where('status', '!=', 'cancelled')
                .get();

            for (const doc of startingTrips.docs) {
                const trip = doc.data();
                if (trip.isExpired || trip.isCancelled) continue;

                const participants = trip.participants || [];
                const tripTitle = trip.title || 'Trip';

                await Promise.all(participants.map(async (uid: string) => {
                    await createNotification({
                        recipientId: uid,
                        type: 'trip_started',
                        title: '🎉 Your trip starts today!',
                        message: `"${tripTitle}" begins today. Have an amazing journey!`,
                        entityId: doc.id,
                        entityType: 'trip',
                        deepLinkRoute: 'TripDetails',
                        deepLinkParams: { tripId: doc.id },
                    });
                    await sendPushToUser(uid, {
                        title: '🎉 Your trip starts today!',
                        body: `"${tripTitle}" begins today. Have an amazing journey!`,
                        data: { route: 'TripDetails', tripId: doc.id },
                    });
                }));

                console.log(`[Scheduler] Sent start notifications for trip ${doc.id}`);
            }
        } catch (e) {
            console.error('[Scheduler] Error in trip start notifications:', e);
        }

        // ==================== 2. TRIP END — AUTO-COMPLETE + RATE PROMPT ====================
        try {
            // Find trips that ended yesterday (toDate was yesterday)
            const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

            const endedTrips = await db.collection('trips')
                .where('toDate', '>=', admin.firestore.Timestamp.fromDate(yesterdayStart))
                .where('toDate', '<', admin.firestore.Timestamp.fromDate(todayStart))
                .get();

            for (const doc of endedTrips.docs) {
                const trip = doc.data();
                if (trip.isCompleted || trip.status === 'cancelled' || trip.isCancelled) continue;

                // Auto-mark as completed
                await doc.ref.update({
                    isCompleted: true,
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Notify participants to rate
                const participants = trip.participants || [];
                const hostId = trip.userId;
                const tripTitle = trip.title || 'Trip';

                const joinedUsers = participants.filter((uid: string) => uid !== hostId);
                await Promise.all(joinedUsers.map(async (uid: string) => {
                    await createNotification({
                        recipientId: uid,
                        type: 'rate_trip',
                        title: '⭐ Rate your trip!',
                        message: `"${tripTitle}" has ended. Share your experience and rate the trip!`,
                        entityId: doc.id,
                        entityType: 'trip',
                        deepLinkRoute: 'TripDetails',
                        deepLinkParams: { tripId: doc.id },
                    });
                    await sendPushToUser(uid, {
                        title: '⭐ Rate your trip!',
                        body: `"${tripTitle}" has ended. Share your experience!`,
                        data: { route: 'TripDetails', tripId: doc.id },
                    });
                }));

                console.log(`[Scheduler] Auto-completed and sent rate prompts for trip ${doc.id}`);
            }
        } catch (e) {
            console.error('[Scheduler] Error in trip end processing:', e);
        }

        // ==================== 3. EXPIRE TRIPS (start date passed) ====================
        try {
            const expiredTrips = await db.collection('trips')
                .where('fromDate', '<', admin.firestore.Timestamp.fromDate(todayStart))
                .where('isExpired', '!=', true)
                .get();

            const batch = db.batch();
            let count = 0;
            for (const doc of expiredTrips.docs) {
                const trip = doc.data();
                if (trip.isExpired || trip.status === 'cancelled') continue;
                batch.update(doc.ref, { isExpired: true });
                count++;
                if (count >= 450) break; // Firestore batch limit safety
            }
            if (count > 0) {
                await batch.commit();
                console.log(`[Scheduler] Expired ${count} trips`);
            }
        } catch (e) {
            console.error('[Scheduler] Error expiring trips:', e);
        }

        // ==================== 4. HIDE GROUP CHATS (7 days after trip end) ====================
        try {
            const oldGroupChats = await db.collection('group_chats')
                .where('hidden', '!=', true)
                .get();

            const batch = db.batch();
            let count = 0;
            for (const chatDoc of oldGroupChats.docs) {
                const chat = chatDoc.data();
                const tripId = chat.tripId;
                if (!tripId) continue;

                const tripDoc = await db.collection('trips').doc(tripId).get();
                if (!tripDoc.exists) {
                    batch.update(chatDoc.ref, { hidden: true });
                    count++;
                    continue;
                }

                const tripData = tripDoc.data();
                const toDate = tripData?.toDate?.toDate?.() || null;
                if (toDate && toDate < sevenDaysAgo) {
                    batch.update(chatDoc.ref, { hidden: true });
                    count++;
                }

                if (count >= 450) break;
            }
            if (count > 0) {
                await batch.commit();
                console.log(`[Scheduler] Hidden ${count} group chats`);
            }
        } catch (e) {
            console.error('[Scheduler] Error hiding group chats:', e);
        }

        console.log('[Scheduler] Daily trip lifecycle completed');
    }
);
