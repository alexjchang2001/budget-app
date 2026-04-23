# Current State

> Last updated: 2026-04-11

## Active Plan

**Plan:** plan-2026-04-budget-app-mvp
**Title:** Budget App MVP — Full Initial Build
**Status:** Planned (ready to start Sprint 1)
**Current Sprint:** Sprint 1 — Foundation

## Current Focus

Plan created from spec v4. 18 tasks across 4 sprints. No source code yet — ready to begin T1.1 (Project Scaffold and Tooling).

## Task Status

### Sprint 1 — Foundation (start here)

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| T1.1 | Project Scaffold and Tooling | P0 | done |
| T1.2 | Database Schema Migration | P0 | done |
| T1.3 | WebAuthn Registration and Assertion | P0 | done |
| T1.4 | Account Recovery Flow | P1 | done |

### Sprint 2 — Core Backend

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| T2.1 | Teller Integration: Webhook and Polling | P0 | done |
| T2.2 | Allocation Engine | P0 | done |
| T2.3 | Transaction Classification Pipeline | P0 | done |
| T2.4 | Bill Confirmation Re-routing Engine | P1 | done |
| T2.5 | Deficit Flow: Three Plans + Insolvent State | P1 | done |

### Sprint 3 — Frontend Screens

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| T3.1 | Screen 0: Setup Flow (5 Steps) | P0 | pending |
| T3.2 | Screen 1: Home | P0 | pending |
| T3.3 | Screen 2: Budget Buckets | P0 | pending |
| T3.4 | Screen 3: Projection and History | P1 | pending |
| T3.5 | Claude Vision Schedule Parsing Route | P1 | pending |

### Sprint 4 — Polish

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| T4.1 | PWA Service Worker Stub and Offline State | P0 | pending |
| T4.2 | App Navigation Shell and Tab Bar | P0 | pending |
| T4.3 | Architecture Compliance Pass | P0 | pending |
| T4.4 | End-to-End Setup and First-Week Flow Validation | P1 | pending |

## What Was Just Done

- **T2.5 done** (auto-updated by hook)

- **T2.5 done**: computeOptimal (flex-cut-first, debt+savings at user pct, food=remainder); computeEmergency (5%/3% income floors, food min $50); computeLongTermResponsible (uniform cut by income*pct, floor enforcement, Flex-first overflow cascade, Emergency fallback when floors+foodMin > distributable); checkInsolvent (strict income < bills+floors+foodMin); POST /api/weeks/[weekId]/deficit-plan (auth, ownership, stores plan + expires at week_end); mid-week second deposit plan expiry already in deposit-detection.ts; 15 unit tests covering all AC; arch check 0 errors.

- **T2.4 done** (auto-updated by hook)

- **T2.4 done**: Migration 007 (confirm_bill_reroute RPC — atomic bill_status update + bucket decrements); engine/reroute.ts (sortBucketsByPriority pure fn, getPriorityOrderedBuckets, rerouteFreedBillAmount via RPC, getBillsBucketId); POST /api/bills/[billId]/confirm (auth, ownership, 409 guard, calls RPC, returns dailyLimit); 6 unit tests for sort ordering

- **T2.3 done** (auto-updated by hook)

- **T2.3 done**: @anthropic-ai/sdk added to package.json; TransactionRow type in supabase.ts; classification/deposit-detection.ts (isDirectDepositBySignals + triggerAllocationForDeposit + detectAndHandleDeposit); classification/prompt.ts (assembleExamples 10-example window, buildBucketTypeMap, buildSystemPrompt, buildUserContent); classification/pipeline.ts (classifyTransaction: deposit-first, Claude claude-sonnet-4-6 with ephemeral prompt caching, confidence routing ≥0.85/0.60-0.84/<0.60); POST /api/transactions/classify; POST /api/transactions/[txId]/override; 20+ unit tests

- **T2.2 done** (auto-updated by hook)

- **T2.2 done**: Migration 006 (run_allocation_writes RPC — atomic upserts + bill_status); engine/week.ts (getMostRecentFriday, createProvisionalWeek, reassignFridayTransactions, promoteProvisionalWeek); engine/allocation.ts (runAllocationEngine, computeDistributable, distributeByPct, computeFloors, routeResidue); engine/deficit.ts (checkDeficitTrigger A+B); engine/daily-limit.ts (getDaysRemainingInWeek, computeDailyLimit, computeOpeningDailyLimit); POST /api/internal/run-allocation; 30+ unit tests

- **T2.1 done** (auto-updated by hook)

- **T2.1 done**: Migration 005 (teller_sync_failed, teller_access_token_iv/tag, teller_degraded_since); teller/client.ts (AES-256-GCM encrypt/decrypt, getAccounts/getTransactions/getBalances); teller/errors.ts (401→flag, 429→exp backoff+jitter+1hr notify, 500→3×retry then flag); teller/polling.ts (dedup by 23505, enqueues classify); POST /api/webhooks/teller (HMAC-SHA256, stores tx, enqueues classify); POST /api/cron/teller-poll (CRON_SECRET auth); vercel.json cron schedules; tests for pure functions. Branch: feat/sprint-2-core-backend

- **T1.4 done** (auto-updated by hook)

- **T1.4 done**: recovery.ts (generateRecoveryCode base62/SHA-256, verifyRecoveryCode constant-time), /recover/verify (email+code → WebAuthn challenge, 401 on mismatch), /recover/complete (replace passkey, regenerate code), recover page UI; updated register/verify to collect recoveryEmail and return recoveryCode
- **T1.3 done** (auto-updated by hook)

- **T1.3 done**: WebAuthn register/login routes, jwt.ts (HS256 7d), auth.ts middleware, webauthn.ts helpers, ReAuthModal (silent re-auth bottom sheet), login page; added 004_auth_fields migration for public key + counter storage
- **T1.2 done** (auto-updated by hook)

- **T1.2 done**: 3 SQL migrations — 001_schema (9 tables, 6 enums), 002_rls (RLS + policies on all 9 tables), 003_seed (classification_config singleton with full seed_examples JSONB)
- **T1.1 done** (auto-updated by hook)

### Session: 2026-04-11 — T1.1 Project Scaffold and Tooling

- Scaffolded Next.js 14 App Router project (TypeScript + Tailwind + ESLint) manually (Node.js not installed on this system)
- Created `src/lib/supabase.ts` (browser client, 16 lines) and `src/lib/supabase-server.ts` (server client, 35 lines)
- Created `src/lib/money.ts` with `dollarsToCents` / `centsToDollars` / `formatCents` helpers
- Added `public/manifest.json` (PWA) + 192×192 placeholder icon
- Configured `next.config.js` with `Content-Type: application/manifest+json` header for `/manifest.json`
- Added ESLint rules: `max-lines` (warn 200), `max-lines-per-function` (error 50)
- Created `vercel.json` documenting all 7 env variable names
- Updated `.env.example` with all required keys
- `bpsai-pair arch check src/` → 0 errors, 0 warnings

### Session: 2026-04-10 — Initial Planning

- Read and analyzed MVP spec v4 (`budget-app-spec-v4.md`)
- Created plan `plan-2026-04-budget-app-mvp` with 18 tasks across 4 sprints
- Wrote full task content (objective, implementation plan, acceptance criteria, verification) for all 18 tasks
- Plan file at: `.claude/plans/bubbly-beaming-hopcroft.md`
- Sprint 3 plan approved; feat/sprint-3-frontend branch created


## What's Next

1. T3.5: Vision backend, then T3.1: Setup Flow


## Blockers

None.

## Key Architectural Notes (set during planning)

- **Cents everywhere**: all monetary values as integer cents; `src/lib/money.ts` for conversion
- **Color system isolation**: Screen 1 and Screen 2 intentionally use DIFFERENT color axes — do NOT share components
- **Engine split**: `allocation.ts` + `week.ts` + `deficit.ts` + `reroute.ts` + `daily-limit.ts`
- **Teller split**: `client.ts` + `polling.ts` + `errors.ts` + webhook route
- **Architecture constraint**: `bpsai-pair arch check <path>` before marking any task done

## Quick Commands

```bash
# Show plan
bpsai-pair plan show plan-2026-04-budget-app-mvp

# List tasks
bpsai-pair task list --plan plan-2026-04-budget-app-mvp

# Start first task
bpsai-pair task update T1.1 --status in_progress

# Next task to work on
bpsai-pair task next
```
