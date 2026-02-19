
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

// ==================== REPORT NOTIFICATIONS ====================

/**
 * Notify the reporter and host when a new report is created.
 */
export const onReportCreated = onDocumentCreated(
    { document: "reports/{reportId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const reportData = snapshot.data();
        const reporterId = reportData.reporterId;
        const targetId = reportData.targetId;
        const targetType = reportData.targetType;
        const reason = reportData.reason;

        // 1. Notify Reporter
        await createNotification({
            recipientId: reporterId,
            type: "report_submitted",
            title: "Report Submitted",
            message: "Thanks for your report. We received it and will review it.",
            entityId: event.params.reportId,
            entityType: "report",
            deepLinkRoute: "Profile",
        });

        // 2. Notify Host (if it's a trip report)
        if (targetType === 'trip' && targetId) {
            try {
                const tripDoc = await db.collection("trips").doc(targetId).get();
                if (tripDoc.exists) {
                    const tripData = tripDoc.data();
                    const hostId = tripData?.userId;

                    if (hostId && hostId !== reporterId) {
                        await createNotification({
                            recipientId: hostId,
                            type: "system",
                            title: "Trip Under Review ⚠️",
                            message: `Your trip "${tripData?.title}" has been reported for: ${reason}.\n\nDetails: ${reportData.description}`,
                            entityId: targetId,
                            entityType: "trip",
                            deepLinkRoute: "TripDetails",
                            deepLinkParams: { tripId: targetId },
                        });

                        await sendPushToUser(hostId, {
                            title: "Trip Reported ⚠️",
                            body: `Your trip "${tripData?.title}" has been reported for: ${reason}.`,
                            data: { route: "TripDetails", tripId: targetId },
                        });
                    }
                }
            } catch (e) {
                console.error("Error notifying host of report:", e);
            }
        }
    }
);
