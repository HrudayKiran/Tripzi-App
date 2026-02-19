/**
 * One-time migration: copies config/version to config/app_settings.
 *
 * Usage:
 * 1. Auth options:
 *    - Put service account JSON at: scripts/service-account.json
 *    - OR set GOOGLE_APPLICATION_CREDENTIALS for ADC
 * 2. Dry run (default):
 *    node scripts/migrate_config_version_to_app_settings.js
 * 3. Apply writes:
 *    set DRY_RUN=false && node scripts/migrate_config_version_to_app_settings.js
 */

const { admin } = require('./_admin_init');

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function migrateConfigDoc() {
    const legacyRef = db.doc('config/version');
    const canonicalRef = db.doc('config/app_settings');

    const legacySnapshot = await legacyRef.get();
    if (!legacySnapshot.exists) {
        console.log('[ConfigMigration] No legacy config/version doc found. Nothing to migrate.');
        return;
    }

    const legacyData = legacySnapshot.data() || {};

    if (DRY_RUN) {
        console.log('[DryRun] Would upsert config/app_settings with:');
        console.log(legacyData);
        return;
    }

    await canonicalRef.set(legacyData, { merge: true });
    console.log('[ConfigMigration] Migrated config/version -> config/app_settings');
}

migrateConfigDoc().catch((error) => {
    console.error('[ConfigMigration] Failed:', error);
    process.exit(1);
});
