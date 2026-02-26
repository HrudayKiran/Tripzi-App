# Report 08: Revalidation and Remaining Gaps

Date: 2026-02-26  
Project: `Tripzi-App`

## Executive Status

- P0: Implemented and deployed.
- P1: Implemented; migration scripts executed (no pending data changes found).
- P2: Implemented and deployed with additional hardening in this pass.
- Admin dashboard: removed from frontend and backend flows.

## What Was Fixed in This Pass

1. Security rule hardening
- Updated `firestore.rules` so only chat creator can delete a chat document.

2. Frontend/backend query alignment
- Updated `mobile/src/screens/GroupInfoScreen.tsx` to use indexed prefix search helper (`mobile/src/utils/searchUsers.ts`) instead of ad-hoc direct query logic.

3. Backend runtime and dependency hygiene
- Updated Functions runtime to Node.js 22 (`functions/package.json`).
- Updated Functions lockfile and applied `npm audit fix` (functions workspace now reports 0 audit vulnerabilities).

4. Quality gates
- Normalized Functions ESLint configuration so lint is now actionable and passing.
- Verified `npm run lint` passes in `functions`.

5. App Check diagnostics tooling
- Added scripts:
  - `scripts/appcheck_services.js`
  - `scripts/enable_api.js`
- These scripts let you inspect App Check service enforcement modes and enable APIs (subject to IAM permissions).

## Validation and Deployment Results

Passed checks:
1. `npm run build` (`functions`)
2. `npm run validate` (`functions`)
3. `npm run lint` (`functions`)
4. `npm run validate` (`mobile`)
5. `firebase deploy --only firestore:rules --dry-run --non-interactive`
6. `firebase deploy --only storage --dry-run --non-interactive`

Deployments:
1. `firebase deploy --only functions --non-interactive` passed.
2. `firebase deploy --only firestore:rules,storage --non-interactive` passed.
3. `firebase functions:list` confirms deployed runtime is `nodejs22`.

## Current Schema Snapshot (Live Sample)

Generated via `node scripts/schema_snapshot.js`:

- `app_config`: count=1
- `chats`: count=1
- `notifications`: count=0
- `trips`: count=1
- `users`: count=2

Observed representative fields:
- `trips`: canonical trip fields present (`fromDate`, `toDate`, `toLocation`, `cost`, etc.)
- `users`: includes verification fields (`ageVerified`, `ageVerifiedAt`, `dateOfBirth`) written via callable path
- `chats`: sample doc has participants metadata and latest message fields

## App Check Status (Important)

- Client integration: implemented (startup initialization + RN Firebase App Check provider setup).
- Backend enforcement: **not enabled yet**.
- Diagnostic result (2026-02-26): `firebaseappcheck.googleapis.com` is disabled for project `tripzi-app`.
- Attempted API enable via script failed due IAM permission gap on current service account.

## Remaining Gaps to Close

1. App Check enforcement (high priority)
- Enable `firebaseappcheck.googleapis.com` in GCP.
- Enforce App Check for Firestore, Storage, and callable Functions after token validation in client builds.

2. Release hygiene
- Ship a fresh mobile build containing latest P2/App Check changes before enforcing App Check in production.

## Update (2026-02-26, later)

The previously listed architecture/security gaps were implemented:
- Public/private profile split is now live (`users` private, `public_users` read-only mirror).
- Group moderation mutations are now callable-backed and Firestore rules block client-side membership/admin mutation.

See `P3_IMPLEMENTATION_STATUS.md` for full details.

## UI/UX Gap Summary (Current vs Target)

Current:
- Core flows are functional with improved query performance and reduced feed/search lag.
- Security hardening and backend consistency improved.

Still lacking:
- Full UX polish pass for edge states (empty/error loading consistency across all screens).
- Centralized public profile model to avoid over-fetch and privacy overexposure.
- Stronger server-owned group moderation actions (better trust boundaries and clearer user feedback paths).
