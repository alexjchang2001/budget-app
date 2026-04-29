---
name: Silent .catch() masks signature drift in budget-app routes
description: API routes use `.catch(() => null)` / `.catch(() => {})` patterns that mask runtime TypeErrors when callers pass the wrong shape to library functions
type: feedback
---

API routes in this project use a consistent pattern of `.catch(() => null)` or `.catch(() => {/* best-effort */})` around imported library calls. When the route author misremembers the function signature, the call throws at runtime (e.g., `tx.posted_at.split` on a string arg), the catch swallows it, the route returns 200, and the UI shows success — but the side effect (allocation, classify, etc.) never happens.

Why: TypeScript would normally catch arg-shape errors at compile time, but the project ships without `tsc --noEmit` in CI (only `bpsai-pair arch check` runs). Strict mode is enabled in tsconfig but never executed. Confirmed instance at review time: `src/app/api/deposits/manual-confirm/route.ts:40` passes `(string, string)` to `triggerAllocationForDeposit`, which expects `(TransactionRow, {id, baseline_weekly_income})`. The `.catch(() => {})` masked the runtime error and the manual deposit confirmation flow silently never ran allocation.

How to apply: When reviewing a route that calls a lib function with `.catch(() => …)`, always cross-check the function signature against the call site. Don't trust that "it works" since the tests don't cover route handlers and ts-check isn't in CI. Pattern to flag: `await someLib(simpleStringArgs).catch(() => null)` where `someLib` is a multi-arg function imported from `@/lib/`.
