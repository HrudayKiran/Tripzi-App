# NxtVibes - Maestro E2E Test Suite

## Overview
This folder contains **31 automated end-to-end test flows** for the NxtVibes mobile app (`com.nxtvibes.mobile`), covering every screen, feature, and user flow.

## Prerequisites

### 1. Maestro CLI (already installed)
```
C:\Users\bhumi\.maestro\bin\maestro.bat
```
Version: 2.6.1

### 2. Android Emulators
- **Medium Phone API 36.1** — for Email/Password login tests
- **Pixel 9 Pro** — for Google Sign-in tests (Google account pre-added to device)

### 3. Test Account
**⚠️ IMPORTANT**: Before running tests, set your actual password in `00_config.yaml`:
```yaml
TEST_PASSWORD: "your_actual_password_here"
```
- Email: `webbusinesswithkiran@gmail.com`
- This account must exist in Supabase with **email confirmed** and **profile completed**

---

## Flow Index

| File | Screen/Feature | Tags |
|------|---------------|------|
| `01_launch_splash.yaml` | Splash screen → Welcome redirect | `auth, launch` |
| `02_welcome_screen.yaml` | Welcome screen UI + CTA | `auth, welcome` |
| `03_start_landing.yaml` | Start screen — landing mode | `auth, start` |
| `04_email_login.yaml` | Full email sign-in → Home | `auth, login, email` |
| `05_login_validation.yaml` | Login form validation errors | `auth, validation` |
| `06_signup_flow.yaml` | Sign up form + navigation | `auth, signup` |
| `07_signup_validation.yaml` | Sign up validation rules | `auth, validation` |
| `08_forgot_password.yaml` | Forgot password flow | `auth, password` |
| `09_home_navigation.yaml` | Home + tab bar navigation | `home, tabs` |
| `10_trip_creation.yaml` | Manual Trip Planner open | `trip` |
| `11_chats_list.yaml` | Chats list + search | `messages` |
| `12_create_group.yaml` | Create Group Chat | `messages, group` |
| `13_chat_send_message.yaml` | Open chat + send message | `messages, chat` |
| `14_chat_context_menu.yaml` | Long press message menu | `messages, chat` |
| `15_group_info.yaml` | Group info screen | `messages, group` |
| `16_profile_screen.yaml` | Profile tab all sections | `profile` |
| `17_edit_profile.yaml` | Edit Profile screen | `profile` |
| `18_settings_screen.yaml` | Settings: theme, haptics | `settings` |
| `19_change_password.yaml` | Change Password screen | `settings, password` |
| `20_terms_screen.yaml` | Terms of Service | `legal` |
| `21_privacy_policy.yaml` | Privacy Policy | `legal` |
| `22_suggest_feature.yaml` | Suggest Feature | `support` |
| `23_help_support.yaml` | Help & Support | `support` |
| `24_user_profile_view.yaml` | View own profile | `profile` |
| `25_logout.yaml` | Full logout + confirmation | `auth, logout` |
| `26_session_persistence.yaml` | Session persists on relaunch | `auth, session` |
| `27_legal_links.yaml` | Terms/Privacy from Start screen | `legal` |
| `28_chat_delete.yaml` | Delete chat with selection | `messages` |
| `29_notifications_modal.yaml` | Notifications bell modal | `home, notifications` |
| `30_full_regression.yaml` | 🔥 Complete E2E regression | `e2e, regression` |

---

## Running Tests

### Start emulators first
```powershell
# Start Medium Phone (for email login)
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone_API_36.1

# Start Pixel 9 Pro (for Google login)
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_9_Pro
```

### Install the debug APK
```powershell
# Wait for emulators to fully boot, then:
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$apk = "android\app\build\outputs\apk\debug\app-debug.apk"

# Check connected devices
& $adb devices

# Install on Medium Phone
& $adb -s emulator-5554 install -r $apk

# Install on Pixel 9 Pro
& $adb -s emulator-5556 install -r $apk
```

### Run tests

#### Single test:
```powershell
$maestro = "C:\Users\bhumi\.maestro\bin\maestro.bat"

# On Medium Phone (email login):
& $maestro --device emulator-5554 test maestro/04_email_login.yaml

# Full regression on Medium Phone:
& $maestro --device emulator-5554 test maestro/30_full_regression.yaml
```

#### All flows in order:
```powershell
& $maestro --device emulator-5554 test maestro/
```

#### With screenshots output:
```powershell
& $maestro --device emulator-5554 --output test-results test maestro/30_full_regression.yaml
```

#### Filter by tag:
```powershell
# Only auth tests
& $maestro --device emulator-5554 test --include-tags auth maestro/
```

---

## Screenshot Naming Convention
Screenshots are named `<flow_number>_<step_description>` and auto-saved by Maestro during test runs.

## Troubleshooting

### "Element not found" errors
- The app may be animating — flows use `waitForAnimationToEnd` before assertions
- Adjust `timeout` values if on slower hardware (increase to 10000)

### Login fails
- Verify `TEST_PASSWORD` in `00_config.yaml` matches Supabase account password
- Ensure email `webbusinesswithkiran@gmail.com` is confirmed in Supabase

### Emulator connection issues
- Run `adb devices` to confirm emulators show as `device` (not `offline`)
- Restart adb server: `adb kill-server && adb start-server`
