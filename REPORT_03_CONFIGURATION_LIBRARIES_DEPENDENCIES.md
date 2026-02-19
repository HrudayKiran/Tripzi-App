# Report 03: Current Configuration, Libraries, Dependencies, Packages

Project: `Tripzi-App`  
Date: 2026-02-19

## A. Firebase/Project Configuration

### Firebase Core
- Firestore rules file: `firestore.rules`
- Firestore indexes file: `firestore.indexes.json`
- Storage rules file: `storage.rules`
- Functions source: `functions` (predeploy build enabled)
- Firebase project alias: `tripzi-app` in `.firebaserc`

### Notable Config Issues
- Storage rules use undefined helper `isAdmin()`:
  - `storage.rules:60`
- Index coverage appears minimal vs query usage:
  - only one composite index in `firestore.indexes.json:2`
  - legacy comments index override remains: `firestore.indexes.json:20`

## B. Functions Stack

### Runtime/Toolchain
- Node engine: `20` (`functions/package.json`)
- TS strict: enabled (`functions/tsconfig.json:9`)
- Output: `lib`

### Packages
- Runtime:
  - `firebase-admin`
  - `firebase-functions`
- Dev:
  - ESLint + TypeScript plugins
  - `firebase-functions-test`
  - `typescript`

### Functions Tooling Health
- Build status: pass (`npm run build` in `functions`)
- Lint status: fail (2244 errors)
  - includes parser issue with `tsconfig.dev.json`
  - style-line-ending mismatch (CRLF vs enforced LF)
  - sample parser error context: `.eslintrc.js` + `functions/tsconfig.dev.json`

## C. Mobile Stack

### Runtime/Toolchain
- Expo SDK: `~54.0.33`
- React: `19.1.0`
- React Native: `0.81.5`
- TypeScript strict: disabled (`mobile/tsconfig.json:3`)
- `allowJs: true` and `noImplicitAny: false` (`mobile/tsconfig.json:7`, `mobile/tsconfig.json:4`)

### Core Libraries in Active Use
- Firebase RN modules:
  - `@react-native-firebase/app`, `auth`, `firestore`, `functions`, `messaging`, `storage`
- Navigation:
  - `@react-navigation/native`, `@react-navigation/stack`, `@react-navigation/bottom-tabs`
- UI/UX:
  - `expo-linear-gradient`, `react-native-animatable`, `@expo/vector-icons`
- Device features:
  - `expo-image-picker`, `expo-location`, `react-native-maps`, `@react-native-community/datetimepicker`

### Package/Usage Gaps (Potential Cleanup Candidates)
The following dependencies showed no direct source import hits in `mobile/src`, `mobile/App.tsx`, `mobile/index.js` during this audit. Validate before removing because some can be plugin/transitive requirements.

- `expo-av`
- `expo-camera`
- `expo-clipboard`
- `expo-constants`
- `expo-font`
- `expo-image-manipulator`
- `expo-media-library`
- `react-native-progress`
- `react-native-reanimated`
- `react-native-svg`
- `expo-splash-screen`

Other observations:
- `react-native-gifted-chat` is present, but source references are effectively absent except shim comments:
  - `mobile/src/shims/keyboard-controller/index.js:4`

## D. App Configuration Risks

- Hardcoded API key in mobile source:
  - `mobile/src/config/secrets.ts:1`
- Public map API keys present in app config (should be restricted by app/package/signature and API scopes):
  - `mobile/app.json`
- Hardcoded app version string in runtime update check:
  - `mobile/App.tsx:20`

## E. Test/Quality Configuration

- Mobile tests:
  - Jest configured (`mobile/jest.config.js`)
  - No tests found on run (`npm test -- --watchAll=false`)
- Type checking:
  - Mobile TS compile fails with 5 errors (`npx tsc --noEmit`)

## F. Configuration Maturity Gaps
- Missing environment separation for secrets and feature flags.
- No shared constants package for notification/event/deep-link enums across app/functions.
- Weak quality gates in CI terms:
  - no passing lint baseline
  - no automated tests
  - no migration test harness

