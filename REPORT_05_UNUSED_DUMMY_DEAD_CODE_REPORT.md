# Report 05: Unused Code, Dummy Code, Dead Paths

Project: `Tripzi-App`  
Date: 2026-02-19

## Method
- Checked navigation wiring, imports, and reference hits across `mobile/src` and `functions/src`.
- Marked findings as:
  - `Confirmed Unused`
  - `Likely Dead/Legacy`
  - `Dummy/Placeholder Behavior`

## A. Confirmed Unused

### 1) Functions
- `functions/src/database.ts`
  - No reference hits from `functions/src` imports.
  - Duplicates admin initialization pattern already in `functions/src/utils/firebase.ts`.

### 2) Mobile Components
- `mobile/src/components/Header.tsx`
  - No imports of `components/Header` detected.
- `mobile/src/components/Message.tsx`
  - No imports of `components/Message` detected.
- `mobile/src/components/TimeAgo.tsx`
  - No imports of `components/TimeAgo` detected.

### 3) Mobile Screen Wiring Gaps
- `SearchScreen` is imported but not routed:
  - import at `mobile/src/navigation/AppNavigator.tsx:21`
  - no `Stack.Screen` entry for Search in navigator list.
- `MessageSettingsScreen` is imported but not routed:
  - import at `mobile/src/navigation/AppNavigator.tsx:41`
  - no `Stack.Screen` entry for message settings.

## B. Likely Dead / Legacy Drift

### 1) Legacy type model not used
- `mobile/src/types/index.ts` uses snake_case fields (`start_date`, `max_travelers`) that are not used elsewhere.
- Reference scans show these fields appear only inside this file.

### 2) KYC legacy remnants after age-verification pivot
- Rules/comment indicate KYC collection removed:
  - `firestore.rules:61`
  - `storage.rules:102`
- App still contains KYC-oriented state/notification/admin fields:
  - `mobile/src/screens/AdminDashboardScreen.tsx:214`
  - `mobile/src/utils/notificationService.ts:127`
  - `mobile/src/utils/imageUpload.ts:5` (`ImageFolder` includes `kyc`)

### 3) Cleanup references removed entities
- Comments/stories cleanup still present:
  - `functions/src/utils/cleanup.ts:51`
  - `functions/src/utils/cleanup.ts:170`
  - `functions/src/utils/cleanup.ts:196`
- Conflicts with “removed in v1.0.0” direction in rules.

## C. Dummy / Placeholder Behavior

### 1) Help & Support submit is local alert only
- `mobile/src/screens/HelpSupportScreen.tsx:27`
- No backend call or queueing.

### 2) Suggest/Bug failure path says “saved locally” but no local save implemented
- `mobile/src/screens/SuggestFeatureScreen.tsx:75`
- `mobile/src/screens/SuggestFeatureScreen.tsx:99`

### 3) Chat pagination stub
- `mobile/src/hooks/useChatMessages.ts:273`
- Function exists but does nothing; `hasMore` may imply capability not actually delivered.

### 4) Notification service methods mostly stubbed
- Multiple handlers marked as “handled by Cloud Function” with no implementation:
  - `mobile/src/utils/notificationService.ts:88`
  - `mobile/src/utils/notificationService.ts:94`
  - `mobile/src/utils/notificationService.ts:102`

### 5) App Check debug token placeholder and unintegrated hook
- Placeholder token string: `mobile/src/hooks/useAppCheck.ts:21`
- Hook not referenced by app startup flows (no external usage hit outside file).

## D. Unused Imports / Variables (Code Hygiene Issues)

- `GoogleSignin` imported but unused:
  - `mobile/src/screens/SettingsScreen.tsx:13`
- `useEffect` imported but unused:
  - `mobile/src/screens/MessageSettingsScreen.tsx:1`
- `AsyncStorage` imported but unused:
  - `mobile/src/screens/MessageSettingsScreen.tsx:14`
- `SAVE_TO_GALLERY_KEY` declared but unused:
  - `mobile/src/screens/MessageSettingsScreen.tsx:16`
- `collection` imported but unused:
  - `mobile/src/hooks/usePushNotifications.ts:3`

## E. Actionable Cleanup Plan
1. Remove or route inactive screens (`SearchScreen`, `MessageSettingsScreen`).
2. Delete unused files (`Header.tsx`, `Message.tsx`, `TimeAgo.tsx`) or wire them intentionally.
3. Remove legacy/stale KYC-only code paths or formally reintroduce KYC feature scope.
4. Replace placeholder UX with real backend implementations or explicit “coming soon” messaging.
5. Enable lint rule enforcement (`noUnusedLocals`, `noUnusedParameters`) in mobile and CI.

