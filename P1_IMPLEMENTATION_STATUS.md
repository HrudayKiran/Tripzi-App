# P1 Implementation Status

Date: 2026-02-19  
Project: `Tripzi-App`

## Scope Covered

This P1 implementation covers:
1. Ratings model unification
2. Trip schema contract alignment (trigger + migration tooling)
3. Version config contract alignment
4. Account cleanup utility repair

---

## 1) Ratings Model Unification

### Changes made
- Switched rating writes in `mobile/src/screens/TripDetailsScreen.tsx` from legacy:
  - `trips/{tripId}/ratings/*`
- To canonical:
  - `ratings/*`

### Effect
- New ratings now correctly trigger backend logic at `functions/src/triggers/ratings.ts`.
- Single source of truth for rating read/write path.

### Migration tooling
- Added `scripts/migrate_ratings_to_top_level.js` to backfill old subcollection ratings into top-level `ratings`.

---

## 2) Trip Field Contract Alignment

### Changes made
- Updated `functions/src/triggers/trips.ts` update-detection logic to use canonical fields first with legacy fallback:
  - Destination: `toLocation` / `location` / `destination`
  - Dates: `fromDate` / `startDate`, `toDate` / `endDate`
  - Cost: `cost` / `costPerPerson` / `totalCost` / `price`
- Also corrected join success notification deep-link route to:
  - `Chat` when chat exists
  - `TripDetails` otherwise

### Effect
- Trip update notifications are now reliable against current app schema.
- Legacy docs still supported during migration window.

### Migration tooling
- Added `scripts/backfill_trip_schema_fields.js` to backfill canonical trip fields on existing documents.

---

## 3) Version Config Contract Alignment

### Changes made
- Reworked config trigger in `functions/src/triggers/config.ts`:
  - Canonical trigger: `config/app_settings`
  - Legacy compatibility trigger: `config/version` (temporary)
  - Notify only when `latestVersion` actually changes
- Added deep-link handling for external URLs:
  - `mobile/src/hooks/usePushNotifications.ts` (`ExternalLink`)
  - `mobile/src/components/NotificationsModal.tsx` (`ExternalLink`)
- Improved app-side update logic in `mobile/App.tsx`:
  - Semantic version comparison helper
  - Handles both:
    - update available (`latestVersion`)
    - forced update (`minVersion`)

### Migration tooling
- Added `scripts/migrate_config_version_to_app_settings.js` to copy legacy config doc to canonical path.

---

## 4) Cleanup Utility Repair

### Changes made
- Rebuilt `functions/src/utils/cleanup.ts` to align with current schema:
  - Fixed notifications path deletion:
    - `notifications/{uid}/items/*`
  - Fixed ratings deletion field:
    - `userId` (instead of `raterId`)
  - Added cleanup for:
    - `suggestions`, `bugs`, `feature_requests`
    - group chat membership maps/arrays (`participants`, `admins`, `participantDetails`, `unreadCount`, `clearedAt`, `deletedBy`)
    - storage prefixes currently in use (`profiles`, `trips`, `groups`, `feedback`, report evidence)
  - Removed obsolete stories/comments-specific cleanup assumptions.

### Effect
- Account deletion now matches actual data model and removes current-path artifacts more reliably.

---

## Validation Executed

1. `npm run build` in `functions`: passed  
2. `npx tsc --noEmit` in `mobile`: passed

---

## Migration Execution Order (Recommended)

1. Dry run:
- `node scripts/migrate_config_version_to_app_settings.js`
- `node scripts/backfill_trip_schema_fields.js`
- `node scripts/migrate_ratings_to_top_level.js`

2. Apply:
- `set DRY_RUN=false && node scripts/migrate_config_version_to_app_settings.js`
- `set DRY_RUN=false && node scripts/backfill_trip_schema_fields.js`
- `set DRY_RUN=false && node scripts/migrate_ratings_to_top_level.js`

3. Deploy:
- `firebase deploy --only functions`
- `firebase deploy --only firestore:rules,storage`

---

## Notes

- Legacy config trigger is intentionally kept for backward compatibility and can be removed after migration freeze window.
- Migration scripts expect `scripts/service-account.json` (same pattern as existing `scripts/cleanup_dup_notifications.js`).
