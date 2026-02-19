# Report 04: Bug Report, Error Report, and Failure Inventory

Project: `Tripzi-App`  
Date: 2026-02-19

## 1) Build/Type/Lint/Test Status

### Mobile Type Check (`npx tsc --noEmit`)
Status: `FAILED`

Errors:
- `TS2678` in `mobile/src/components/NotificationsModal.tsx:23`
- `TS2678` in `mobile/src/components/NotificationsModal.tsx:25`
- `TS2678` in `mobile/src/components/NotificationsModal.tsx:29`
- `TS2678` in `mobile/src/components/NotificationsModal.tsx:31`
- `TS2741` in `mobile/src/screens/SearchScreen.tsx:233`

Root causes:
- Notification enum mismatch between UI and hook types.
- `TripCard` requires `onReportPress`, but `SearchScreen` does not pass it.

### Functions Lint (`npm run lint`)
Status: `FAILED`

High-level output:
- `TS18003` parser/config issue around `functions/tsconfig.dev.json`
- Massive style/rule violations (2244 total)
- Line-ending policy conflict (`CRLF` vs enforced `LF`) dominates

### Functions Build (`npm run build`)
Status: `PASSED`

### Mobile Tests (`npm test -- --watchAll=false`)
Status: `FAILED` (no tests found)

## 2) Critical Functional/Security Bugs

### CRITICAL-01: Undefined helper in Storage rules
- `storage.rules:60` calls `isAdmin()` but no helper exists in file.
- Risk: rule deployment/behavior failure for carousel write path.

### CRITICAL-02: Exposed AI secret in mobile app
- `mobile/src/config/secrets.ts:1` contains live Groq API key.
- `mobile/src/services/AIService.ts:87` uses it directly from client.
- Risk: key theft, quota abuse, billing/security impact.

### CRITICAL-03: Self-service age verification
- Client writes verified status directly: `mobile/src/screens/AgeVerificationScreen.tsx:64`.
- User update rule protected list omits `ageVerified`: `firestore.rules:43`.
- Risk: underage bypass and policy/compliance failure.

### CRITICAL-04: Trip participants can be mutated too broadly
- Rule allows participant/current traveler-only edits for any authed user: `firestore.rules:74`.
- Client writes join/leave directly: `mobile/src/components/TripCard.tsx:143`.
- Risk: unauthorized member injection/removal.

## 3) High-Severity Behavioral Bugs

### HIGH-01: Notification type contract mismatch
- Hook type union: `mobile/src/hooks/useNotifications.ts:7`
- Modal switch expects extra types: `mobile/src/components/NotificationsModal.tsx:23`
- Trigger/client emit different strings: `functions/src/triggers/trips.ts:123`, `mobile/src/utils/notificationService.ts:12`
- Impact: compile errors and incorrect icon/routing behavior.

### HIGH-02: Config route mismatch for update push
- Function emits `ExternalLink`: `functions/src/triggers/config.ts:44`
- Push handler cases exclude it: `mobile/src/hooks/usePushNotifications.ts:200`
- Impact: notification tap no-op for update notices.

### HIGH-03: Ratings write/read mismatch
- Read top-level ratings: `mobile/src/screens/TripDetailsScreen.tsx:151`
- Write subcollection ratings: `mobile/src/screens/TripDetailsScreen.tsx:211`
- Trigger listens top-level only: `functions/src/triggers/ratings.ts:11`
- Impact: ratings appear inconsistent, triggers may not fire for new writes.

### HIGH-04: Trip update detector checks wrong fields
- Trigger compares `destination/price/startDate/endDate`: `functions/src/triggers/trips.ts:226`
- App writes `toLocation/cost/fromDate/toDate`: `mobile/src/screens/TripDetailsScreen.tsx:417`
- Impact: update notifications can silently miss real changes.

### HIGH-05: Push preference logic writes unrelated field
- Settings writes `users.pushToken`: `mobile/src/screens/SettingsScreen.tsx:44`
- Real token store is `push_tokens/{uid}`: `mobile/src/hooks/usePushNotifications.ts:138`
- Impact: user expectation mismatch (toggle may not truly disable delivery).

## 4) Medium Bugs / Consistency Faults

### MEDIUM-01: Search screen compile break
- `TripCard` requires `onReportPress`: `mobile/src/components/TripCard.tsx:30`
- `SearchScreen` usage omits it: `mobile/src/screens/SearchScreen.tsx:233`

### MEDIUM-02: Group icon upload path not defined in Storage rules
- App writes `groups/{filename}`:
  - `mobile/src/screens/CreateGroupScreen.tsx:136`
  - `mobile/src/screens/GroupInfoScreen.tsx:135`
- No corresponding `groups` rule in `storage.rules`.

### MEDIUM-03: Cleanup utility drift bugs
- Deletes user subcollection `users/{uid}/items`: `functions/src/utils/cleanup.ts:27`
  - notifications are stored at `notifications/{uid}/items` in utility flow.
- Ratings cleanup uses `raterId`: `functions/src/utils/cleanup.ts:42`
  - rating docs use `userId`: `functions/src/triggers/ratings.ts:17`

### MEDIUM-04: Push token map can bloat
- Device ID generated with timestamp: `mobile/src/hooks/usePushNotifications.ts:20`
- Impact: every session can create new token slot; stale token growth.

## 5) UX/Behavior Bugs (User-Visible)

- Help support “Send Message” does not send backend ticket:
  - `mobile/src/screens/HelpSupportScreen.tsx:27`
- Suggest/Bug screen catch path says “saved locally” but no local persistence implemented:
  - `mobile/src/screens/SuggestFeatureScreen.tsx:75`
  - `mobile/src/screens/SuggestFeatureScreen.tsx:99`
- Chat pagination function is placeholder:
  - `mobile/src/hooks/useChatMessages.ts:273`

## 6) Immediate Bug-Fix Priority
1. Fix rules/security criticals (`storage.rules`, `users` update protection, trips/chats write boundaries).
2. Remove leaked secrets and move AI calls backend-side.
3. Fix compile blockers (`NotificationsModal` enum alignment, `SearchScreen` props).
4. Unify schema contracts (ratings, trip fields, config doc/route enums).
5. Repair cleanup utility to match current data model.

