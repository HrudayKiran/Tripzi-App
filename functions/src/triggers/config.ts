import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firebase';
import { createNotification } from '../utils/notifications';

// ==================== SYSTEM NOTIFICATIONS ====================

/**
 * Shared handler for version config changes.
 */
const handleVersionConfigChange = async (event: any) => {
    const beforeData = event.data?.before?.data() || {};
    const afterData = event.data?.after?.data();

    // Ignore deletes.
    if (!afterData) return;

    const previousVersion = beforeData.latestVersion;
    const newVersion = afterData.latestVersion;

    // Only notify when version actually changes.
    if (!newVersion || newVersion === previousVersion) return;

    const releaseNotes = afterData.releaseNotes || 'New features available!';
    const storeUrl = afterData.storeUrl || 'https://play.google.com/store/apps/details?id=com.tripzi.mobile';

    const usersSnapshot = await db.collection('users').get();

    const batchPromises = usersSnapshot.docs.map((userDoc) =>
        createNotification({
            recipientId: userDoc.id,
            type: 'system',
            title: 'Update Available 🚀',
            message: `Tripzi ${newVersion} is available: ${releaseNotes}`,
            deepLinkRoute: 'ExternalLink',
            deepLinkParams: { url: storeUrl },
        })
    );

    await Promise.all(batchPromises);
};

/**
 * Canonical config document trigger.
 */
export const onAppSettingsUpdated = onDocumentWritten(
    { document: 'config/app_settings' },
    handleVersionConfigChange
);

/**
 * Legacy compatibility trigger.
 * Keep temporarily until all writes are migrated to config/app_settings.
 */
export const onLegacyVersionUpdated = onDocumentWritten(
    { document: 'config/version' },
    handleVersionConfigChange
);
