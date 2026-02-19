# Deployment Status (P0 + P1)

Date: 2026-02-19

## Executed and Passed

1. `npm run build` (`functions`)  
2. `npx tsc --noEmit` (`mobile`)  
3. `firebase deploy --only firestore:rules --dry-run`  
4. `firebase deploy --only storage --dry-run`  
5. `firebase deploy --only firestore:rules,storage --non-interactive`  
   - Firestore rules deployed successfully
   - Storage rules deployed successfully

## Blocked Item

### Functions deploy
- Command run: `firebase deploy --only functions --non-interactive`
- Current blocker: Secret Manager API is disabled for project `tripzi-app`
- Error category: `HTTP 403 secretmanager.googleapis.com not enabled`

## Required to Unblock

1. Enable Secret Manager API for project `tripzi-app`
2. Set Groq secret:
- `firebase functions:secrets:set GROQ_API_KEY`
3. Redeploy functions:
- `firebase deploy --only functions`

## Migration Scripts Update

Migration scripts were updated to support either:
1. `scripts/service-account.json`, or
2. Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`)

Updated scripts:
- `scripts/migrate_config_version_to_app_settings.js`
- `scripts/backfill_trip_schema_fields.js`
- `scripts/migrate_ratings_to_top_level.js`
- `scripts/cleanup_dup_notifications.js`

Shared initializer:
- `scripts/_admin_init.js`
