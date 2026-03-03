import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';

const TAWKTO_TICKET_EMAIL = 'tickets@tripzi.p.tawk.email';

/**
 * Helper: send email via mailto-compatible Firestore extension
 * Uses the "mail" collection which triggers emails via the Firebase Extension
 * "Trigger Email from Firestore" (firebase/extensions-mail).
 * 
 * If the extension is not installed, the document is still created
 * and can be processed later. To set up:
 * 1. Install the "Trigger Email from Firestore" extension
 * 2. Configure SMTP settings in the extension
 * 3. The extension watches the "mail" collection for new documents
 */
async function queueEmail(to: string, subject: string, html: string) {
    try {
        await db.collection('mail').add({
            to,
            message: {
                subject,
                html,
            },
        });
    } catch (e) {
        console.error('Failed to queue email:', e);
    }
}

/**
 * Build a professional HTML email body
 */
function buildTicketEmail(type: string, details: Record<string, string>): string {
    const headerColor = type === 'report' ? '#EF4444' : type === 'bug' ? '#F59E0B' : '#3B82F6';
    const typeLabel = type === 'report' ? 'Trip Report' : type === 'bug' ? 'Bug Report' : 'Feature Suggestion';

    let detailsHtml = '';
    for (const [key, value] of Object.entries(details)) {
        if (value) {
            detailsHtml += `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;vertical-align:top;">${key}</td><td style="padding:8px 12px;color:#6B7280;">${value}</td></tr>`;
        }
    }

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <div style="background:${headerColor};padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">🎫 ${typeLabel}</h1>
        </div>
        <div style="padding:24px;">
            <table style="width:100%;border-collapse:collapse;">
                ${detailsHtml}
            </table>
        </div>
        <div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">Tripzi App &mdash; Automated Ticket System</p>
        </div>
    </div>`;
}

function buildUserConfirmationEmail(type: string, userName: string): string {
    const typeLabel = type === 'report' ? 'Report' : type === 'bug' ? 'Bug Report' : 'Feature Suggestion';

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <div style="background:linear-gradient(135deg,#9d74f7,#EC4899);padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Tripzi</h1>
        </div>
        <div style="padding:32px 24px;">
            <h2 style="color:#111827;margin:0 0 12px;">Hi ${userName || 'there'} 👋</h2>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">
                We've received your <strong>${typeLabel}</strong> and it's been added to our ticket queue. 
                Our team will review it shortly.
            </p>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">
                You don't need to take any further action. We'll follow up if we need more details.
            </p>
            <p style="color:#6B7280;font-size:14px;margin:0;">
                Thank you for helping us improve Tripzi! 🙏
            </p>
        </div>
        <div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">This is an automated message from Tripzi. Please do not reply.</p>
        </div>
    </div>`;
}

// ==================== SUGGESTION TICKET ====================

export const onSuggestionCreated = onDocumentCreated(
    { document: "suggestions/{suggestionId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;
        const data = snapshot.data();

        // Forward to tawk.to
        const subject = `[Feature Suggestion] ${data.title || 'Untitled'}`;
        const details: Record<string, string> = {
            'Title': data.title || 'N/A',
            'Category': data.category || 'N/A',
            'Description': data.description || 'N/A',
            'User': data.userName || 'N/A',
            'Email': data.userEmail || 'N/A',
            'User ID': data.userId || 'N/A',
        };
        await queueEmail(TAWKTO_TICKET_EMAIL, subject, buildTicketEmail('suggestion', details));

        // Send confirmation to user
        if (data.userEmail) {
            await queueEmail(
                data.userEmail,
                'We received your suggestion! 🎉 - Tripzi',
                buildUserConfirmationEmail('suggestion', data.userName)
            );
        }
    }
);

// ==================== BUG REPORT TICKET ====================

export const onBugReportCreated = onDocumentCreated(
    { document: "bugs/{bugId}" },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;
        const data = snapshot.data();

        const subject = `[Bug Report] ${data.title || 'Untitled'}`;
        const details: Record<string, string> = {
            'Title': data.title || 'N/A',
            'Category': data.category || 'N/A',
            'Severity': data.severity || 'N/A',
            'Description': data.description || 'N/A',
            'Steps to Reproduce': data.stepsToReproduce || 'N/A',
            'User': data.userName || 'N/A',
            'Email': data.userEmail || 'N/A',
            'User ID': data.userId || 'N/A',
        };
        await queueEmail(TAWKTO_TICKET_EMAIL, subject, buildTicketEmail('bug', details));

        // Send confirmation to user
        if (data.userEmail) {
            await queueEmail(
                data.userEmail,
                'We received your bug report! 🐛 - Tripzi',
                buildUserConfirmationEmail('bug', data.userName)
            );
        }
    }
);
