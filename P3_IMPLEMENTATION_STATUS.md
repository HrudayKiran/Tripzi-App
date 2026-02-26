# P3 Implementation Status

Date: 2026-02-26  
Project: `Tripzi-App`

## Scope Implemented

1. Public/private user profile split
- Firestore rules updated:
  - `users/{userId}` is now owner-read only.
  - Added `public_users/{userId}` read-only mirror for authenticated clients.
- Added backend public profile sync on every user write/delete:
  - `functions/src/triggers/users.ts` now mirrors `users/*` -> `public_users/*`.
- Updated account cleanup to remove public mirror:
  - `functions/src/utils/cleanup.ts`.
- Added migration script:
  - `scripts/migrate_users_to_public_users.js`.

2. Callable group moderation
- Added callable endpoints:
  - `addGroupMember`
  - `removeGroupMember`
  - `promoteGroupAdmin`
  - `demoteGroupAdmin`
  - `leaveGroup`
- Implemented in:
  - `functions/src/callable/groups.ts`
  - exported via `functions/src/index.ts`.
- Tightened chat update rules to block client-side membership/admin mutations:
  - `firestore.rules`.

3. Frontend migration to new contracts
- Switched user discovery/search to `public_users`:
  - `mobile/src/utils/searchUsers.ts`
  - `mobile/src/screens/ChatsListScreen.tsx`
  - `mobile/src/screens/CreateGroupScreen.tsx`
  - `mobile/src/screens/GroupInfoScreen.tsx`
- Switched non-owner profile reads to `public_users`:
  - `mobile/src/screens/UserProfileScreen.tsx`
  - `mobile/src/screens/TripDetailsScreen.tsx`
  - `mobile/src/components/TripCard.tsx`
  - `mobile/src/api/useTrips.ts`
- Added reusable public profile utility:
  - `mobile/src/utils/publicProfiles.ts`
- Group moderation UI now uses callable functions:
  - `mobile/src/screens/GroupInfoScreen.tsx`

## Migration Execution

Executed:
1. `node scripts/migrate_users_to_public_users.js` (dry run)
2. `set DRY_RUN=false&& node scripts/migrate_users_to_public_users.js` (apply)

Result:
- Scanned users: 2
- Written public profiles: 2

## Validation Executed (Passed)

1. `npm run build` (`functions`)
2. `npm run validate` (`functions`)
3. `npm run lint` (`functions`)
4. `npx tsc --noEmit` (`mobile`)
5. `npm run validate` (`mobile`)
6. `firebase deploy --only firestore:rules --dry-run --non-interactive`

## Deployment Executed (Passed)

1. `firebase deploy --only functions --non-interactive`
2. `firebase deploy --only firestore:rules,storage --non-interactive`

Notable backend changes now live:
- New callable moderation functions deployed in `us-central1`.
- Updated `onUserUpdated` trigger logic deployed.
- Updated Firestore rules (public/private profile split + chat membership hardening) deployed.

## Live Schema Snapshot (Post-Migration)

From `node scripts/schema_snapshot.js`:
- `public_users`: present, count=2
- `users`: count=2

`public_users` fields now include:
- `displayName`
- `username`
- `photoURL`
- `bio`
- `ageVerified`
- `ratingCount`
- `totalRating`
- `createdAt`
- `updatedAt`
- `userId`
