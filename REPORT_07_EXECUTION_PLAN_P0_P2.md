# Report 07: Execution Plan (P0/P1/P2)

Project: `Tripzi-App`  
Date: 2026-02-19

## Goal
Ship a secure, consistent Firebase architecture with minimal production risk:
1. Stop critical security exposure (P0).
2. Remove schema drift via controlled migrations (P1).
3. Add hardening/performance/quality gates (P2).

---

## Phase P0 (Immediate: 24-72 hours)

## P0-1 Secret Leak + AI Backend Migration
Files:
- `mobile/src/config/secrets.ts`
- `mobile/src/services/AIService.ts`
- `functions/src/index.ts`
- new `functions/src/callable/ai.ts`

Changes:
- Remove hardcoded Groq key from mobile.
- Add callable function (e.g. `planTripWithAI`) that reads secret from Firebase Functions secrets.
- Make mobile `AIService` call callable function instead of direct `fetch` to Groq.

Infra:
- Set secret: `firebase functions:secrets:set GROQ_API_KEY`
- Redeploy functions after build.

Acceptance:
- No provider key in app source/bundle.
- AI feature works end-to-end through callable function.

## P0-2 Firestore Rules: Lock Sensitive User Fields
File:
- `firestore.rules`

Changes:
- In `/users/{userId}`:
  - restrict read to owner/admin OR split public profile model.
  - block owner updates to: `role`, `ageVerified`, `ageVerifiedAt`, `dateOfBirth`, `kyc`, `kycStatus`, verification/admin fields.
- Keep age verification writes server-controlled (function/admin only).

Acceptance:
- User cannot self-set age verification/admin fields.
- Other users cannot read private profile fields if private-read model chosen.

## P0-3 Firestore Rules: Trip Join/Leave Guardrails
File:
- `firestore.rules`

Changes:
- Replace broad participants update with self-only join/leave constraint for non-owner:
  - non-owner can only add/remove own UID.
  - cannot mutate other trip fields.
- Keep owner/admin full edit rights.

Acceptance:
- Unauthorized user cannot modify someone else’s membership.

## P0-4 Firestore Rules: Chat Mutation Lockdown
Files:
- `firestore.rules`
- `mobile/src/screens/GroupInfoScreen.tsx`
- optional new callable files for membership/admin ops

Changes:
- Restrict chat doc updates by participants to safe UI keys only (e.g. `deletedBy`, `clearedAt`, `mutedBy`, `pinnedBy`).
- Move participant/admin membership mutations to callable functions:
  - `addGroupMember`
  - `removeGroupMember`
  - `promoteGroupAdmin`
  - `demoteGroupAdmin`

Acceptance:
- Participants cannot directly self-elevate/admin-edit via client update.

## P0-5 Notifications: Trusted Write Path Only
Files:
- `firestore.rules`
- `mobile/src/utils/notificationService.ts`
- `mobile/src/components/TripCard.tsx`
- `mobile/src/screens/TripDetailsScreen.tsx`

Changes:
- In rules, block client notification create (`allow create: if false;`) and rely on backend.
- Remove direct client notification writes (`NotificationService.onLeaveTrip` call sites).
- Keep function-trigger notifications as single source of truth.

Acceptance:
- Client cannot spoof notifications.
- Leave/join notifications still delivered via triggers.

## P0-6 Storage Rules Hardening + Missing Groups Path
File:
- `storage.rules`

Changes:
- Add missing `isAdmin()` helper for Storage.
- Restrict chat media access to chat participants (lookup chat doc).
- Restrict report evidence access to report owner/admin.
- Add secure `groups` path rule used by app uploads (`groups/{...}`).

Acceptance:
- Any-authenticated access removed from sensitive paths.
- Group icon uploads succeed under explicit authorization.

## P0-7 Compile Blockers
Files:
- `mobile/src/components/NotificationsModal.tsx`
- `mobile/src/hooks/useNotifications.ts`
- `mobile/src/utils/notificationService.ts`
- `mobile/src/screens/SearchScreen.tsx`

Changes:
- Normalize notification type union (single enum contract across app/functions).
- Pass required `onReportPress` prop to `TripCard` in `SearchScreen`.

Acceptance:
- `npx tsc --noEmit` passes in `mobile`.

---

## Phase P1 (Short Term: 3-10 days)

## P1-1 Ratings Model Unification
Files:
- `mobile/src/screens/TripDetailsScreen.tsx`
- `functions/src/triggers/ratings.ts`
- `firestore.rules`
- new migration script in `scripts/`

Changes:
- Canonicalize ratings to top-level `ratings/{ratingId}`.
- Stop writing to `trips/{tripId}/ratings`.
- Backfill existing subcollection docs into top-level.

Acceptance:
- Single ratings source.
- Host rating notifications and reads are consistent.

## P1-2 Trip Date/Price/Destination Contract Unification
Files:
- `functions/src/triggers/trips.ts`
- `mobile/src/screens/CreateTripScreen.tsx`
- `mobile/src/screens/TripDetailsScreen.tsx`
- `mobile/src/screens/AdminDashboardScreen.tsx`
- migration script

Changes:
- Choose one canonical schema (`fromDate`/`toDate`, `toLocation`, `cost`).
- Update triggers currently checking `startDate/endDate/destination/price`.
- Backfill old fields.

Acceptance:
- Trip update detection works for all current edits.

## P1-3 Version Config Contract Unification
Files:
- `mobile/App.tsx`
- `functions/src/triggers/config.ts`

Changes:
- Use one doc path only (`config/app_settings` recommended).
- Use one route contract (remove unsupported `ExternalLink` or add handler in push hook).

Acceptance:
- Version update prompt and push-link behavior are consistent.

## P1-4 Cleanup Utility Repair
File:
- `functions/src/utils/cleanup.ts`

Changes:
- Fix notifications path cleanup (`notifications/{uid}/items`).
- Fix ratings cleanup field (`userId` not `raterId`).
- Remove legacy comments/stories cleanup or gate with existence checks.

Acceptance:
- Account deletion removes actual current-model data.

---

## Phase P2 (Hardening: 1-3 weeks)

## P2-1 App Check Enforcement
Files:
- `mobile/App.tsx`
- `mobile/src/hooks/useAppCheck.ts`

Changes:
- Initialize App Check at app startup.
- Remove placeholder debug token from source.
- Enforce App Check in Firebase console for Firestore/Storage/Functions.

## P2-2 Performance Refactors
Files:
- `mobile/src/api/useTrips.ts`
- `mobile/src/screens/SearchScreen.tsx`
- `mobile/src/screens/FeedScreen.tsx`
- `functions/src/triggers/*`

Changes:
- Reduce N+1 reads by denormalizing owner summary onto trip docs.
- Replace client-side broad filtering with indexed query patterns.
- Parallelize high-fanout function loops safely.

## P2-3 Quality Gates
Files:
- `functions/.eslintrc.js`
- `functions/tsconfig.dev.json`
- add tests under `functions` and `mobile`

Changes:
- Fix lint parser/line-ending policy mismatch.
- Add Firestore rules emulator tests.
- Add smoke tests for critical user flows.

Acceptance:
- Lint/build/typecheck/tests become release gates.

---

## Deployment Sequence (Recommended)
1. Ship P0 rules + functions in maintenance window (small blast radius release).
2. Ship mobile app that matches tightened rules.
3. Run P1 migrations with backup + staged verification.
4. Remove compatibility paths after successful monitoring window.

---

## Validation Checklist
- `npm --prefix functions run build`
- `npx tsc --noEmit` in `mobile`
- Firestore/Storage rule emulator tests pass
- Manual smoke:
  - age verification
  - join/leave trip
  - group member/admin actions
  - chat message edit/delete/read
  - notification tap routing
  - account deletion

