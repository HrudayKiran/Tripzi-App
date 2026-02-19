# Report 06: Performance and Lag Analysis

Project: `Tripzi-App`  
Date: 2026-02-19

## Executive View
- Main lag drivers are query shape, read amplification, and sequential backend fanout.
- You have good UI-level optimizations in feed rendering, but backend/data access patterns still cause unnecessary latency and cost.

## 1) Read Amplification Hotspots

### HOTSPOT-01: Trips feed N+1 user reads
- For each trip doc, app fetches corresponding user doc.
- Evidence:
  - `mobile/src/api/useTrips.ts:31`
  - `mobile/src/api/useTrips.ts:38`
- Impact:
  - slow feed load under higher trip counts
  - large Firestore read costs

### HOTSPOT-02: Search performs broad client-side filtering
- User query path fetches a fixed batch then filters locally.
- Evidence:
  - `mobile/src/screens/SearchScreen.tsx:44`
  - `mobile/src/screens/SearchScreen.tsx:49`
  - `mobile/src/screens/FeedScreen.tsx:102`
  - `mobile/src/screens/FeedScreen.tsx:107`
- Impact:
  - poor relevance and scaling
  - unnecessary data transfer

### HOTSPOT-03: Admin dashboard full scans
- Pulls full collections for stats and lists.
- Evidence:
  - `mobile/src/screens/AdminDashboardScreen.tsx:104`
  - `mobile/src/screens/AdminDashboardScreen.tsx:105`
  - `mobile/src/screens/AdminDashboardScreen.tsx:106`
- Impact:
  - slow admin load
  - expensive reads in production scale

## 2) Backend Processing Latency

### HOTSPOT-04: Sequential async loops in notification fanout
- Functions often `await` inside `for` loops.
- Evidence:
  - `functions/src/triggers/chats.ts`
  - `functions/src/triggers/trips.ts`
  - `functions/src/triggers/reports.ts`
- Impact:
  - linear latency with recipient count
  - slower trigger completion

### HOTSPOT-05: Push token map growth
- Device ID uses timestamp each registration attempt.
- Evidence:
  - `mobile/src/hooks/usePushNotifications.ts:20`
- Impact:
  - stale token buildup
  - larger token payloads and slower push operations

## 3) Data/Index Efficiency Gaps

### HOTSPOT-06: Index coverage likely incomplete
- Only one composite index defined; query set is broader.
- Evidence:
  - `firestore.indexes.json:2`
  - notification dedupe query: `functions/src/utils/notifications.ts:32`
- Impact:
  - index-missing errors under traffic
  - fallback query inefficiency

### HOTSPOT-07: Schema drift causes wasted work and missed optimizations
- Trip/date/rating/config field mismatches increase fallback logic and branching.
- Evidence:
  - `functions/src/triggers/trips.ts:226`
  - `mobile/src/screens/TripDetailsScreen.tsx:417`
  - `mobile/src/screens/TripDetailsScreen.tsx:211`

## 4) UX Responsiveness Risks

### RISK-01: Chat pagination not implemented
- Placeholder method without actual fetch path.
- Evidence:
  - `mobile/src/hooks/useChatMessages.ts:273`
- Impact:
  - older messages inaccessible
  - long sessions may feel inconsistent

### RISK-02: Silent failure handling hides latency/failures
- Many catch blocks suppress actionable errors.
- Impact:
  - UI appears stuck or inconsistent without explanation
  - hard to diagnose slow paths

## 5) What the App Is Lagging In
- Scalable query design.
- Server-side command orchestration for high-write features.
- Index and schema governance.
- Error observability and user-facing retry states.
- Automated performance regression checks.

## 6) Performance Fix Plan (Priority)
1. Refactor feed/search read paths:
   - denormalize trip owner summary on trip docs
   - use server-side search strategy (or indexed prefix queries)
2. Parallelize trigger fanout safely (`Promise.allSettled` with controlled batching).
3. Normalize token lifecycle:
   - stable device IDs
   - stale token pruning job
4. Expand composite indexes for known query patterns.
5. Implement real chat pagination and expose explicit load state.
6. Add instrumentation:
   - function duration/error metrics
   - screen-level timing logs for feed/search/chat open.

