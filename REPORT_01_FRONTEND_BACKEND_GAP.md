# Report 01: Frontend-Backend Gap (UI/UX vs Firebase)

Project: `Tripzi-App`  
Date: 2026-02-19  
Scope: Mobile UI flows vs Firestore/Storage rules, functions, and schema

## Executive Summary
- Your frontend is feature-rich, but many sensitive workflows are still client-authoritative.
- The biggest UX/backend gap is trust boundaries: UI assumes backend enforcement that is either missing or inconsistent.
- Result: security risk, data drift, and user-facing inconsistencies (actions that appear valid but fail or behave unpredictably).

## Gap Matrix

| Area | Frontend UX Behavior | Backend Reality | Impact | Evidence |
|---|---|---|---|---|
| Age Verification | User taps verify, app writes verified status directly | Rules allow self-write path for age fields | Verification can be bypassed | `mobile/src/screens/AgeVerificationScreen.tsx:64`, `firestore.rules:43` |
| Trip Join/Leave | Join/leave feels simple and reliable | Any auth user can mutate `participants/currentTravelers` on any trip | Unauthorized membership edits, trip integrity risk | `mobile/src/components/TripCard.tsx:143`, `mobile/src/screens/TripDetailsScreen.tsx:263`, `firestore.rules:74` |
| Group Admin/Members | Admin actions in UI are direct and immediate | Chat doc updates are broad for participants | Membership/admin state can be manipulated client-side | `mobile/src/screens/GroupInfoScreen.tsx:182`, `mobile/src/screens/GroupInfoScreen.tsx:282`, `firestore.rules:88` |
| Notifications | In-app notifications appear system-originated | Any authenticated client can create notifications for any user | Spoofing/spam, trust erosion | `mobile/src/utils/notificationService.ts:60`, `firestore.rules:117` |
| Search People UX | User search suggests people quickly | Search flow reads user docs with email field exposure | PII overexposure risk and scaling issues | `mobile/src/screens/SearchScreen.tsx:49`, `mobile/src/screens/FeedScreen.tsx:107`, `firestore.rules:34` |
| Group Icon Upload | User can pick and upload group icon | Storage path `groups/*` has no matching rule | Uploads fail or depend on permissive defaults | `mobile/src/screens/CreateGroupScreen.tsx:136`, `mobile/src/screens/GroupInfoScreen.tsx:135`, `storage.rules` |
| Ratings UX | UI displays and submits ratings | Reads top-level `ratings`, writes `trips/{tripId}/ratings` | Inconsistent rating visibility/trigger behavior | `mobile/src/screens/TripDetailsScreen.tsx:151`, `mobile/src/screens/TripDetailsScreen.tsx:211`, `functions/src/triggers/ratings.ts:11` |
| Trip Edit UX | User edits trip dates/details | Function compares `startDate/endDate/destination/price`, app writes `fromDate/toDate/toLocation/cost` | Update notifications/logic miss real changes | `functions/src/triggers/trips.ts:226`, `functions/src/triggers/trips.ts:231`, `mobile/src/screens/TripDetailsScreen.tsx:417` |
| Push Preferences | User toggles push in Settings | Push infra uses `push_tokens`; settings writes unrelated `users.pushToken` | Toggle doesn’t fully control push delivery state | `mobile/src/screens/SettingsScreen.tsx:44`, `mobile/src/hooks/usePushNotifications.ts:138`, `functions/src/utils/notifications.ts:67` |
| Version Update UX | App checks config and shows update prompt | App reads `config/app_settings`; trigger listens `config/version` | One path can update silently while other path stays stale | `mobile/App.tsx:15`, `functions/src/triggers/config.ts:13` |
| Notification Deep Links | Push/open should navigate correctly | Trigger uses `ExternalLink`; client navigation switch has no such case | Some pushes become no-op | `functions/src/triggers/config.ts:44`, `mobile/src/hooks/usePushNotifications.ts:199` |

## What Is Lacking
- A strict backend command layer for sensitive actions (join/leave, group admin changes, moderation transitions).
- Canonical schema contracts (ratings path, trip date fields, chat shape, config doc path).
- Strong client/server type contract for notifications and deep-link route enums.
- Clear public/private user data split.
- End-to-end validation ownership (rules + function validation + tests).

## Priority Closure Plan
1. Move sensitive writes to callable functions and lock direct client updates in rules.
2. Unify schemas (ratings, dates, config, chat shape) and run backfill migrations.
3. Enforce private profile boundaries and reduce user-doc read exposure.
4. Normalize notification types/routes in one shared contract.
5. Add emulator rule tests and migration verification tests before next release.

