# Report 02: Architecture Design (Current vs After Fixing)

Project: `Tripzi-App`  
Date: 2026-02-19

## Current Architecture

### Runtime Topology
- Mobile app writes directly to Firestore and Storage for most business actions.
- Cloud Functions mostly react after writes (notifications, cleanup, derived behavior).
- Security rules are expected to enforce invariants, but several critical invariants are not fully enforced.

### Current Flow (Simplified)
1. Client writes domain docs (`trips`, `chats`, `messages`, `reports`, `notifications`).
2. Firestore triggers observe changes and send notifications/push.
3. UI assumes write success means valid business state.

### Current Strengths
- Fast feature delivery via direct client writes.
- Real-time Firestore experience across trips/chats/notifications.
- Good trigger coverage for common notification scenarios.

### Current Weaknesses
- Trust boundary is too client-heavy.
- Schema/version drift across app, rules, and functions.
- Sensitive actions not centralized in server-controlled commands.
- Inconsistent deep-link and notification typing.

## Target Architecture (After Fixing)

### Design Principles
- Client is presentation + intent layer.
- Backend commands own sensitive state transitions.
- Rules become strict guards, not primary business logic engine.
- One schema contract per entity with migration/version strategy.

### Target Flow (Simplified)
1. Client invokes callable/HTTPS command for sensitive actions:
   - join/leave trip
   - member/admin changes in groups
   - moderation decisions
   - AI provider requests
2. Function validates auth + domain invariants, writes canonical schema.
3. Triggers remain side-effect layer (notifications, fanout, cleanup).
4. Rules restrict direct writes to low-risk user-owned fields only.

## Current vs Target Table

| Dimension | Current | Target |
|---|---|---|
| Write Authority | Mostly client-driven | Command-driven (functions) for sensitive operations |
| Security Model | Rules-only for many invariants | Rules + function validation + tests |
| Schema Management | Drift present across client/functions/rules | Canonical schema with migration gates |
| Notifications | Mixed type/route contracts | Shared typed contract for event type + route |
| Secrets | API key in mobile source | Secret manager / server-side only |
| Observability | Logs only, minimal audit trails | Structured event logs + failure metrics |

## Recommended Target Components
- `mobile`: UI + non-sensitive writes only.
- `functions/commands`: callable endpoints for sensitive domain operations.
- `functions/triggers`: asynchronous side effects only.
- `schema-contract`: shared types/enums (notification type, deep-link routes, core entity fields).
- `migrations`: scripted backfills for ratings/date/config/chat schema convergence.
- `tests`:
  - Firestore rules emulator tests
  - function integration tests for sensitive commands

## Migration Sequence (Architecture-Level)
1. Introduce callable commands with dual-write compatibility.
2. Shift UI from direct writes to commands (trip joins, group membership/admin ops, notification creation).
3. Tighten rules after rollout confidence.
4. Remove legacy write paths and schema fallbacks.
5. Freeze schema contract with versioned changelog.

## What Your Architecture Is Lacking
- A dedicated domain service layer between UI and Firebase data plane.
- Contract governance for cross-layer fields and enums.
- Test gates for rules and migrations.
- Explicit abuse controls (App Check enforcement + command-level throttling).

