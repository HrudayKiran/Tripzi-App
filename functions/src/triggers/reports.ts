
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification, sendPushToUser } from '../utils/notifications';

const TAWKTO_TICKET_EMAIL = 'tickets@tripzi.p.tawk.email';

async function queueEmail(to: string, subject: string, html: string) {
    try {
        await db.collection('mail').add({ to, message: { subject, html } });
    } catch (e) {
        console.error('Failed to queue email:', e);
    }
}

// ==================== REPORT NOTIFICATIONS ====================

/**
 * Notify the reporter and host when a new report is created.
 * Also forwards the report to tawk.to and sends user confirmation.
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

        // 1. Notify Reporter (in-app)
        await createNotification({
            recipientId: reporterId,
            type: "report_submitted",
            title: "Report Submitted",
            message: "Thanks for your report. We received it and will review it.",
            entityId: event.params.reportId,
            entityType: "report",
            deepLinkRoute: "Profile",
        });

        // 2. Forward to tawk.to ticket
        const subject = `[Trip Report] ${reportData.tripTitle || 'Untitled Trip'} - ${reason}`;
        const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
            <div style="background:#EF4444;padding:24px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:20px;">🎫 Trip Report</h1>
            </div>
            <div style="padding:24px;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:8px 12px;font-weight:600;">Trip</td><td style="padding:8px 12px;">${reportData.tripTitle || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Reason</td><td style="padding:8px 12px;">${reason || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Type</td><td style="padding:8px 12px;">${reportData.type || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Description</td><td style="padding:8px 12px;">${reportData.description || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Reporter</td><td style="padding:8px 12px;">${reportData.reporterName || 'N/A'} (${reportData.reporterEmail || 'N/A'})</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Trip ID</td><td style="padding:8px 12px;">${targetId || 'N/A'}</td></tr>
                </table>
            </div>
        </div>`;
        await queueEmail(TAWKTO_TICKET_EMAIL, subject, html);

        // 3. Send confirmation email to user
        if (reportData.reporterEmail) {
            const confirmHtml = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
                <div style="background:linear-gradient(135deg,#9d74f7,#EC4899);padding:24px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Tripzi</h1>
                </div>
                <div style="padding:32px 24px;">
                    <h2 style="color:#111827;margin:0 0 12px;">Hi ${reportData.reporterName || 'there'} 👋</h2>
                    <p style="color:#4B5563;line-height:1.6;">We've received your <strong>Report</strong> and our team will review it within 24 hours. You don't need to take any further action.</p>
                    <p style="color:#6B7280;font-size:14px;">Thank you for helping us keep Tripzi safe! 🙏</p>
                </div>
            </div>`;
            await queueEmail(reportData.reporterEmail, 'We received your report ✅ - Tripzi', confirmHtml);
        }

        // 4. Notify Host (if it's a trip report)
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
