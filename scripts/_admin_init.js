const fs = require('fs');
const path = require('path');

let admin;
try {
    admin = require('firebase-admin');
} catch (_) {
    // Reuse Functions workspace dependency when root does not install firebase-admin.
    admin = require(path.join('..', 'functions', 'node_modules', 'firebase-admin'));
}

function resolveProjectId() {
    if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;

    const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
    if (!fs.existsSync(firebaseRcPath)) return undefined;

    try {
        const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
        return rc?.projects?.default;
    } catch (_) {
        return undefined;
    }
}

/**
 * Initializes firebase-admin for local scripts.
 *
 * Resolution order:
 * 1. scripts/service-account.json (if present)
 * 2. GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials
 */
function initAdmin() {
    if (admin.apps.length > 0) {
        return admin;
    }

    const serviceAccountPath = path.join(__dirname, 'service-account.json');
    const projectId = resolveProjectId();

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        const options = {
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId || serviceAccount.project_id,
        };
        admin.initializeApp(options);
        return admin;
    }

    // Falls back to ADC (GOOGLE_APPLICATION_CREDENTIALS / workload identity / gcloud auth)
    const options = {
        credential: admin.credential.applicationDefault(),
        projectId,
    };

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log(
            '[scripts] GOOGLE_APPLICATION_CREDENTIALS is not set. ' +
            'If ADC is unavailable, provide scripts/service-account.json.'
        );
    }

    admin.initializeApp(options);
    return admin;
}

module.exports = {
    admin: initAdmin(),
};
