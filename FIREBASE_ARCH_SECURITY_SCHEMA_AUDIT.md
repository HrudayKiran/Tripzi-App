# Firebase Architecture, Schema, Security Audit

Project: `Tripzi-App`  
Date: 2026-02-19  
Scope: Firestore, Storage, Cloud Functions, mobile backend integration

---

## 1. Current Architecture

### Backend Components
- **Firestore**: primary database for users, trips, chats, notifications, moderation, app config.
- **Storage**: media files (profiles, trips, chats, carousel, report evidence, feedback images).
- **Cloud Functions**:
  - Firestore triggers for `trips`, `chats/messages`, `ratings`, `reports`, `users`, `config/version`.
  - Auth trigger `onUserDeleted` for cleanup.
  - Callable function `deleteMyAccount`.
- **Mobile app**:
  - Direct Firestore reads/writes for most features.
  - Direct Storage uploads/deletes.
  - Direct client-side AI calls to Groq API.

### Functional Flow
- User signs in via Google, profile created in `users/{uid}`.
- User creates trip in `trips`.
- Joining/leaving trip updates `participants` array and triggers trip functions.
- Chat system stores chat docs in `chats`, messages in subcollection `messages`.
- Push notifications use `push_tokens/{uid}` + function helper.
- Reports and feedback are written directly by client.

---

## 2. Current Firestore Schema (Observed)

## `users/{userId}`
Common fields observed:
- `userId`, `email`, `displayName`, `photoURL`, `username`
- `createdAt`, `lastLoginAt`, `lastLogoutAt`
- `role` (`user`/`admin`)
- `ageVerified`, `ageVerifiedAt`, `dateOfBirth`
- optional social/meta: `bio`, `followers[]`, `following[]`
- optional KYC-like fields: `kyc.status`, `kyc.verifiedAt`, `kyc.rejectedAt`, `kyc.rejectionReason`, `kycStatus`
- preferences: `pushNotifications`

## `trips/{tripId}`
Common fields observed:
- Identity: `userId`, `title`, `description`
- Locations: `fromLocation`, `toLocation`, `location`, `mapsLink`
- Dates: `fromDate`, `toDate` (client)  
  - functions also expect `startDate`, `endDate` in some logic
- Media: `images[]`, `coverImage`, `imageLocations[]`
- Capacity: `participants[]`, `currentTravelers`, `maxTravelers`
- Classification: `tripTypes[]`, `tripType`, `transportModes[]`, `genderPreference`
- Pricing: `cost`, `costPerPerson`, `totalCost`
- Stay: `accommodationType`, `bookingStatus`, `accommodationDays`
- Extras: `mandatoryItems[]`, `placesToVisit[]`, `likes[]`
- Status: `status`, `isCancelled`
- Timestamps: `createdAt`

## `chats/{chatId}`
Two shapes are currently used:

1. **Direct/group chat standard shape** (hooks/screens):
- `type` (`direct`/`group`)
- `participants[]`
- `participantDetails.{uid}` map
- `admins[]` (for groups)
- `groupName`, `groupIcon`, `createdBy`
- `unreadCount.{uid}`
- `deletedBy[]`, `clearedAt.{uid}`
- `mutedBy[]`, `pinnedBy[]`
- `createdAt`, `updatedAt`
- `lastMessage` object (`text`, `senderId`, `senderName`, `timestamp`, `type`)

2. **Trip chat shortcut shape** (created in some screens):
- `type`, `tripId`, `tripTitle`, `participants`, `createdBy`, `createdAt`
- `lastMessage` string
- `lastMessageTime`

### `chats/{chatId}/messages/{messageId}`
Fields observed:
- `senderId`, `senderName`
- `type` (`text`, `image`, `location`, `voice`, `system`, `trip_share`, etc.)
- `text`, `mediaUrl`, `location`, `replyTo`, `mentions[]`
- `status`, `readBy`, `deliveredTo`
- `deletedFor[]`, `deletedForEveryoneAt`
- `editedAt`
- `createdAt`

### `chats/{chatId}/live_shares/{uid}`
Fields observed:
- `latitude`, `longitude`, `address`
- `displayName`, `photoURL`
- `timestamp`, `isActive`, `validUntil`

## `notifications/{userId}/items/{notificationId}`
Fields observed:
- `type`, `title`
- `message` and/or `body`
- `entityId`, `entityType`
- `actorId`, `actorName`, `senderId`
- `deepLinkRoute`, `deepLinkParams`, `data`
- `read`, `readAt`, `createdAt`

## `push_tokens/{userId}`
- `tokens.{deviceId}` map entries:
  - `token`, `platform`, `updatedAt`

## `reports/{reportId}`
- `tripId`, `tripTitle`
- `targetId`, `targetType`
- `reporterId`, `reportedUserId`
- `type`, `reason`, `description`, `evidence[]`
- `status`, `assignedAdmin`, `resolution`
- `createdAt`, `resolvedAt`

## `suggestions/{id}`, `bugs/{id}`, `feature_requests/{id}`
- Typical fields: `userId`, content fields, `createdAt`

## `app_config/{docId}`
- Example: `splash_carousel` with `images[]`

## `config/{docId}`
- **App reads**: `config/app_settings` (`minVersion`, `latestVersion`, `storeUrl`)
- **Function trigger reads**: `config/version` (`latestVersion`, `releaseNotes`, `storeUrl`)

## `ratings` (schema drift)
- **Rules/functions expect top-level**: `ratings/{ratingId}`
- **Client currently writes subcollection**: `trips/{tripId}/ratings/{ratingId}`

---

## 3. Current Storage Schema (Observed)

Configured/ruled paths:
- `carousel/{**}`
- `profiles/{userId}/{fileName}`
- `trips/{userId}/{**}`
- `trip_videos/{userId}/{**}`
- `chats/{chatId}/{**}`
- `reports/{reportId}/{**}`
- `feedback/{userId}/{**}`

Used by app but not currently ruled:
- `groups/{filename}` (group icons)

---

## 4. Security Posture (Current)

## Critical Issues
1. **`storage.rules` uses `isAdmin()` but no `isAdmin` helper exists there**
- `allow write: if isAdmin();` at carousel rule.
- Must be fixed immediately.

2. **Age verification can be self-written by users**
- Rules do not block self-updating `ageVerified`/`dateOfBirth`.
- Client directly sets `ageVerified: true`.

3. **Trip participant update rule is too permissive**
- Any authenticated user can update `participants/currentTravelers` on any trip.

4. **Chat update rule is too permissive**
- Any chat participant can update most chat fields, including sensitive membership/admin metadata.

5. **Groq API key is exposed in mobile source**
- Secret in app code means anyone can extract and abuse it.

## High Issues
1. **Notifications can be created by any authenticated user for any recipient**
- Enables spoof/spam notification writes.

2. **`users` collection is readable by any authenticated user**
- Current rule allows broad profile reads, including PII fields (`email`, `dateOfBirth`) present in user documents.

3. **Chat media readable/writable/deletable by any authenticated user**
- Should be limited to chat participants.

4. **Report evidence readable/deletable by any authenticated user**
- Sensitive moderation evidence should be restricted.

5. **Rules and client behavior mismatch for message updates**
- Rules allow only `readBy/status` updates for messages.
- Client updates `editedAt`, `deletedFor`, `deletedForEveryoneAt`.

## Medium Issues
1. **Schema drift: ratings path mismatch (top-level vs trip subcollection)**
2. **Schema drift: date fields mismatch (`fromDate/toDate` vs `startDate/endDate`)**
3. **Schema drift: app version doc mismatch (`config/app_settings` vs `config/version`)**
4. **Storage path mismatch: `groups/` uploads without storage rule**
5. **Cleanup code still references removed legacy collections (`stories`, `comments`)**
6. **Cleanup notification path mismatch (`users/{uid}/items` vs `notifications/{uid}/items`)**
7. **Indexes likely incomplete for current query patterns**
8. **App Check exists but is not wired into app startup flow**

---

## 5. What Must Be Fixed/Updated

## Immediate (P0)
1. Rotate and revoke leaked Groq API key.
2. Move AI call to server-side function/proxy and remove key from app.
3. Fix `storage.rules` compile/safety issue (`isAdmin` helper or remove admin write path).
4. Lock `users` update rule so users cannot set:
- `role`, `ageVerified`, `kyc*`, verification/admin fields.
5. Reduce `users` read exposure:
- Split public profile fields from private user fields or tighten `users` read rule to owner/admin only.
6. Lock `trips` participant update rule:
- Non-owner can only add/remove **self** and cannot arbitrarily adjust others.
7. Lock `chats` update rule:
- Restrict allowed keys and membership/admin changes to authorized actors.
8. Restrict notification create:
- Only owner/admin/backend pathway.
9. Restrict chat/report storage access to proper participants/admins/owner.

## Near-Term (P1)
1. Decide one canonical rating model and use it everywhere:
- Recommended: top-level `ratings/{ratingId}` (already used by rules/functions).
2. Standardize date fields:
- Recommended canonical: `fromDate`/`toDate` or `startDate`/`endDate` (pick one).
3. Standardize app version config doc path:
- Use one source (`config/app_settings` or `config/version`) across app + functions.
4. Standardize `chat.lastMessage` shape as object everywhere.
5. Add missing storage rule for `groups/`.
6. Remove/replace dead code paths in cleanup and indexes.

## Hardening (P2)
1. Enforce App Check in app startup and in Firebase products.
2. Add Firestore emulator tests for rules.
3. Add function-level validation for all sensitive writes.
4. Add operational logging/alerts for moderation and auth-deletion cleanup.

---

## 6. Required Migrations

## Migration A: Ratings Path Unification
Current:
- Client writes `trips/{tripId}/ratings`
- Rules/functions read `ratings`

Target:
- Top-level `ratings/{ratingId}`

Steps:
1. Update client writes to top-level `ratings`.
2. Backfill existing `trips/{tripId}/ratings` docs to top-level.
3. Recompute/verify any host rating aggregates.
4. Remove legacy trip-subcollection reads.

## Migration B: Trip Date Fields
Current mixed usage:
- Client: `fromDate`, `toDate`
- Functions/admin logic: some `startDate`, `endDate`

Target:
- One canonical pair.

Steps:
1. Update functions to read canonical fields.
2. Backfill historical trip docs (`startDate/endDate` or `fromDate/toDate`).
3. Remove fallback date parsing paths after migration window.

## Migration C: Version Config Path
Current:
- App: `config/app_settings`
- Function: `config/version`

Target:
- One canonical doc.

Steps:
1. Pick canonical doc path.
2. Update app and function to same path.
3. Backfill missing fields (`latestVersion`, `minVersion`, `storeUrl`, `releaseNotes`).
4. Remove old path readers after release.

## Migration D: Chat Schema Consolidation
Current mixed chat doc shapes.

Target:
- Single chat schema with typed `lastMessage` object and consistent metadata.

Steps:
1. Define required chat schema contract.
2. Migrate existing chat docs with missing fields/defaults.
3. Update all creators (trip creation, AI creation, direct/group creation) to one schema.

## Migration E: Storage Group Icons
Current:
- App writes `groups/{filename}` without storage rule.

Target:
- Add secure rule and migrate to ownership-based path (recommended):
  - `groups/{chatId}/{filename}` or `groups/{ownerUid}/{chatId}/{filename}`

Steps:
1. Add rule for current path temporarily (compat).
2. Ship client update to new canonical path.
3. Migrate old files, update stored URLs, then remove temporary rule.

## Migration F: Cleanup Logic
Current cleanup references old collections and wrong notification path.

Steps:
1. Update cleanup targets:
- `notifications/{uid}/items` instead of `users/{uid}/items`.
- ratings field alignment (`userId` vs `raterId`).
2. Remove dead legacy cleanup paths (`stories`, `comments`) or gate them.
3. Add integration tests for account deletion.

---

## 7. Recommended Target Architecture (After Fixes)

1. **Client** performs only safe writes (profile edits, message send, own settings).
2. **Callable/HTTPS Functions** handle sensitive state transitions:
- join/leave trip
- group admin/member changes
- moderation status changes
- account deletion orchestration
- AI provider calls
3. **Rules** enforce ownership + immutable sensitive fields.
4. **Storage paths** map cleanly to ownership/authorization model.
5. **Single schema contract** for each entity with versioned migrations.
6. **App Check + server-side secrets** for abuse resistance.

---

## 8. Minimal Action Checklist

- [ ] Revoke Groq key and remove from app.
- [ ] Fix storage rules (`isAdmin` issue + access scope tightening).
- [ ] Block self-write of `ageVerified` and admin/kyc fields.
- [ ] Restrict trip participant updates to self-only behavior.
- [ ] Restrict chat doc/message updates to intended fields.
- [ ] Restrict notification creation to trusted path.
- [ ] Unify ratings path and migrate old docs.
- [ ] Unify date fields and migrate old docs.
- [ ] Unify config version doc path.
- [ ] Add storage rules for group icon path and migrate.
- [ ] Fix cleanup utility and validate with tests.
- [ ] Add missing indexes from actual query inventory.
- [ ] Enable and wire App Check at app startup.

---

## 9. Note on Data Safety During Migration

Before migrations:
1. Export Firestore and Storage metadata.
2. Run migrations in staging using Firebase Emulator + a copy dataset.
3. Release in phased rollout:
- dual-read/write compatibility window
- finalize schema switch
- remove compatibility code

---

## 10. Evidence Map (Key References)

- `storage.rules:60` uses `isAdmin()` but no helper is defined in `storage.rules`.
- `firestore.rules:43` user update-protected fields list excludes `ageVerified`; client writes it at `mobile/src/screens/AgeVerificationScreen.tsx:64` and `mobile/src/screens/ProfileScreen.tsx:110`.
- `firestore.rules:34` allows broad authenticated reads of `users`; user docs include `email` in `mobile/src/screens/StartScreen.tsx:88` and DOB in `mobile/src/screens/AgeVerificationScreen.tsx:65`.
- `firestore.rules:71` permits broad trip participant mutation; client join/leave writes in `mobile/src/components/TripCard.tsx:143` and `mobile/src/screens/TripDetailsScreen.tsx:263`.
- `firestore.rules:88` allows broad chat doc updates by any participant; membership/admin writes are client-driven in `mobile/src/screens/GroupInfoScreen.tsx:183`.
- `firestore.rules:97` allows only `readBy/status` message updates; client also edits/deletes message fields in `mobile/src/screens/ChatScreen.tsx:763`.
- `firestore.rules:117` allows notification create for any authenticated user; direct client writes in `mobile/src/utils/notificationService.ts:60`.
- `storage.rules:109` and `storage.rules:122` expose chat/report file paths to any authenticated user.
- Group icon uploads to `groups/*` in `mobile/src/screens/CreateGroupScreen.tsx:136`, but no matching `groups` rule exists in `storage.rules`.
- Groq key is in client source `mobile/src/config/secrets.ts:1` and used directly in `mobile/src/services/AIService.ts:87`.
- Ratings drift: top-level `ratings` in `functions/src/triggers/ratings.ts:11` and `firestore.rules:126`, but client writes `trips/{tripId}/ratings` in `mobile/src/screens/TripDetailsScreen.tsx:211`.
- Date drift: functions rely on `startDate/endDate` in `functions/src/triggers/trips.ts:231`; app writes `fromDate/toDate` in `mobile/src/screens/CreateTripScreen.tsx:241`.
- Config drift: app reads `config/app_settings` in `mobile/App.tsx:15`; trigger listens to `config/version` in `functions/src/triggers/config.ts:13`.
- Cleanup drift: notifications path mismatch at `functions/src/utils/cleanup.ts:27` vs `functions/src/utils/notifications.ts:53`; ratings field mismatch (`raterId` vs `userId`) at `functions/src/utils/cleanup.ts:42`.
