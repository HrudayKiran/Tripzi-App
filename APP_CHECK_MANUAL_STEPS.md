# App Check Manual Steps (Tripzi)

Date: 2026-02-26

## Current backend status

- Firestore App Check: `UNENFORCED`
- Storage App Check: `UNENFORCED`
- Auth App Check: `UNENFORCED`

You are in safe **monitoring mode** for development.

---

## Step 1) Prepare local env for dev build

1. Copy `mobile/.env.example` to `mobile/.env`.
2. Set:
- `EXPO_PUBLIC_ENABLE_APPCHECK=true`
- `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN=<your debug token from Firebase App Check console>`

If web build is used, also set:
- `EXPO_PUBLIC_APPCHECK_WEB_SITE_KEY=<recaptcha v3 site key>`

---

## Step 2) Build and run a dev client (not Expo Go)

From `mobile`:

```bash
npx expo prebuild
npx expo run:android
```

or iOS:

```bash
npx expo prebuild
npx expo run:ios
```

Then test flows that hit:
- Firestore (feed/search/trips)
- Storage (image upload)
- Functions (AI + age verification)

---

## Step 3) Confirm App Check metrics

In Firebase Console > App Check:
- Cloud Firestore should start showing verified requests.
- Storage should start showing verified requests.

Wait ~5-15 minutes for metrics.

---

## Step 4) Functions App Check enforcement

Functions cannot be globally enforced from the App Check service table like Firestore/Storage.
For callable functions, enforcement is code-level (`enforceAppCheck` in onCall options).

Current project state:
- Callables are live and working.
- App Check enforcement for Functions is not yet enabled in callable options.

Recommended timing:
- Enable this only after Firestore/Storage verified traffic is stable in development.

---

## Step 5) Move Firestore/Storage to Enforced (later)

When verified traffic is stable:

1. Firebase Console > App Check > Firestore > switch to Enforced.
2. Firebase Console > App Check > Storage > switch to Enforced.

Optional script path (already added to repo):

```bash
set MODE=ENFORCED&& set SERVICES=firestore.googleapis.com,firebasestorage.googleapis.com&& node scripts\appcheck_services.js
```

Rollback quickly if needed:

```bash
set MODE=UNENFORCED&& set SERVICES=firestore.googleapis.com,firebasestorage.googleapis.com&& node scripts\appcheck_services.js
```

---

## Step 6) Ship production build

After monitoring succeeds:

```bash
# Android
eas build -p android --profile production
eas submit -p android --latest

# iOS
eas build -p ios --profile production
eas submit -p ios --latest
```

---

## Quick verification commands

```bash
# Check App Check service modes
node scripts\appcheck_services.js

# Schema snapshot
node scripts\schema_snapshot.js

# Backend quality gates
npm --prefix functions run lint
npm --prefix functions run validate
npm --prefix mobile run validate
```
