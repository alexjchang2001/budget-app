# Budget App — MVP Spec v4

> Remediated from v3 following full audit. All 13 v3 audit issues addressed.
> All prior audit issues (v2: 14, v3: 13) confirmed resolved and carried forward.
> User input applied: deficit trigger uses both the 92% formula AND a hard $50/week food minimum — whichever fires first triggers deficit state.

---

## Overview

A mobile web app (PWA) built for one user, connected to Bank of America via Teller.io. It solves a specific problem: variable restaurant industry income, impulse spending (especially late-night delivery), and a budgeting system that collapses the moment income goes off-projection. The app is designed around the assumption that you will check it at 2am after a shift. It has to work for that version of you, not just the morning version who set the budget.

---

## The problem this solves

Three compounding failure modes that kill every existing budgeting system for this use case:

1. **Income volatility** — shifts get cut, motivation dips, and the weekly projection breaks. Most apps require a full manual rebuild. This one recalculates automatically the moment a deposit clears.
2. **Late-night impulse spending** — the highest-risk window is after shifts or drinking. Delivery is the primary blowout category. The app surfaces the damage in real time.
3. **System abandonment** — when the plan breaks, rebuilding feels like punishment. Income is auto-detected. Everything else is automatic.

---

## Locked decisions log

| # | Decision | Answer |
|---|---|---|
| 1 | Authentication | Passkey (Face ID / Touch ID). Recovery via backup email + one-time 16-char code shown at setup. |
| 2 | Transaction categorization | Claude-assisted with tiered confidence routing. Cold-start seeded with hardcoded merchant examples. |
| 3 | Bill verification | Teller auto-confirms on matching transaction. Manual "Mark as paid" always visible — no delay, no condition. |
| 4 | Income detection | Auto-detected via Teller direct deposit webhook. No manual logging. |
| 5 | Deficit floors | Bills = fixed dollar total, Debt min 5%, Savings min 3%, Food = hard $50/week floor, Flex can zero. |
| 6 | Offline behavior | Cached last-known state with staleness timestamp. Never blocks. |
| 7 | History | Stored from day one. Architected for future income prediction model. |
| 8 | Budget week boundary | Friday → Thursday. Week record created on deposit detection. Provisional week created at setup. |
| 9 | Per-shift income range | Stored on `schedule_parse`, not `user`. Feeds future seasonal prediction model. |
| 10 | Deficit trigger | Fires if EITHER: bills exceed 92% of income OR income leaves < $50 for food after floors. |
| 11 | Color system | Screen 1 (daily limit): % of opening daily limit remaining. Screen 2 (buckets): % of weekly allocation spent. Different axes by design — documented explicitly. |
| 12 | Re-routing logic | Server-side, runs on `bill_status` change. Not frontend. |
| 13 | Rounding residue | Explicit step in allocation engine. Residue routed to Savings. Logged on week record. |

---

## Data model

### `user`
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| passkey_credential_id | text | WebAuthn credential. Invalidated and replaced on recovery. |
| recovery_email | text | Stored at setup. Used only for account recovery — never for login or notifications. |
| recovery_code_hash | text | SHA-256 hash with stored salt. Single-use — regenerated after each use. |
| recovery_code_salt | text | Salt for recovery code hash |
| teller_enrollment_id | text | From Teller Connect OAuth |
| teller_access_token | text | Encrypted at rest |
| baseline_weekly_income | integer | Cents — used before first deposit clears and to seed provisional week |
| created_at | timestamp | |

**Note on recovery code hashing:** SHA-256 with a unique salt is used (not bcrypt) because the 16-character random alphanumeric code has ~95 bits of entropy — far above the threshold where bcrypt's slow hashing adds meaningful security. SHA-256 is appropriate for high-entropy tokens.

---

### `bill`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → user |
| name | text | e.g. "Rent" |
| amount | integer | Cents — fixed dollar amount, never percentage-based |
| due_day_of_month | integer | 1–31 |
| recurrence | enum | `monthly` only in MVP |
| active | boolean | Soft delete |

---

### `bucket`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → user |
| name | text | e.g. "Debt payoff" |
| allocation_pct | decimal | % of **post-bills remainder** only. Must sum to 100 across non-bill buckets. Ignored if `type = 'bills'`. |
| priority_order | integer | Re-routing sequence when freed bill allocation is distributed. Bills always evaluate first but route to others. Default order: Debt(1) → Savings(2) → Food(3) → Flex(4). |
| type | enum | `bills`, `debt`, `savings`, `food`, `flex`, `custom` |
| deficit_floor_pct | decimal | Minimum % of income protected in deficit. Null only for `flex`. |

**Key constraint:** `allocation_pct` only applies to `type != 'bills'`. Bill amounts are drawn from the `bill` table as fixed dollar totals. The allocation engine subtracts total fixed bills first, then distributes the remainder by percentage.

---

### `week`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → user |
| week_start | date | Always a Friday — the payday date that opens this budget week |
| week_end | date | Always the following Thursday |
| payday | date | Date deposit actually cleared. Null until detected or manually confirmed. |
| income_actual | integer | Cents — set when deposit detected or manually confirmed. Null until then. |
| income_projected_low | integer | Cents — defaults to `user.baseline_weekly_income` until overridden by confirmed schedule parse |
| income_projected_high | integer | Cents — defaults to `user.baseline_weekly_income` until overridden |
| deficit_plan | enum | `optimal`, `emergency`, `long_term_responsible`, null |
| deficit_plan_chosen_at | timestamp | |
| deficit_plan_expires_at | timestamp | Set to `week_end` at selection. Overridden to `now()` if a new income event arrives mid-week. |
| rounding_residue | integer | Cents — logged for auditability. Always routed to Savings. |
| status | enum | `projected`, `active`, `closed` |

**Week boundary rule:** Friday → Thursday. On setup completion, a provisional `week` record is created immediately (see Allocation engine — provisional week). When a real deposit is detected, a new `week` record is created if none exists for that Friday, or the existing provisional record is promoted to `active`.

---

### `bucket_allocation`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| week_id | uuid | FK → week |
| bucket_id | uuid | FK → bucket |
| allocated_amount | integer | Cents — computed by allocation engine, updated on bill confirmation re-routing |
| spent_amount | integer | Cents — running total from confirmed transactions |
| floor_amount | integer | Cents — computed minimum, enforced in all deficit plans |
| opening_allocated_amount | integer | Cents — snapshot of allocated_amount at week creation, used for daily limit color threshold |

---

### `transaction`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → user |
| teller_transaction_id | text | External ID, unique |
| amount | integer | Cents — negative = debit, positive = credit |
| description | text | Raw from Teller |
| merchant_name | text | Normalized by Teller |
| posted_at | timestamp | |
| week_id | uuid | FK → week — reassigned if transaction posts on same Friday as new week creation (see reassignment rule) |
| bucket_id | uuid | FK → bucket — set by Claude classification, updatable by user |
| classification_confidence | decimal | 0–1 |
| classification_override | boolean | True if user manually reclassified |
| is_direct_deposit | boolean | True if identified as weekly paycheck |
| bill_id | uuid | FK → bill — populated if transaction matches a known bill |

**Friday reassignment rule:** When a new `week` record is created (deposit detected on Friday), any transactions from that same calendar Friday currently assigned to the prior week are reassigned to the new week. This step runs immediately after week creation, before the allocation engine runs.

---

### `bill_status`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| week_id | uuid | FK → week |
| bill_id | uuid | FK → bill |
| status | enum | `unpaid`, `teller_confirmed`, `manually_confirmed` |
| confirmed_at | timestamp | |
| confirmed_by | enum | `teller`, `user` |
| transaction_id | uuid | FK → transaction — populated only for `teller_confirmed` |

Manual override (`confirmed_by = 'user'`) is always available on Screen 2, regardless of Teller state. No delay, no condition. Teller auto-confirm runs in parallel and sets `confirmed_by = 'teller'` when a matching debit is detected.

---

### `schedule_parse`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → user |
| week_id | uuid | FK → week — the week this projection applies to |
| raw_screenshot_url | text | Supabase storage |
| parsed_shift_count | integer | From Claude vision |
| parsed_shift_days | text[] | Day-of-week strings e.g. `["Mon", "Wed", "Fri", "Sat"]`. MVP limitation: no calendar date anchoring — day strings only. Iteration 4 will require actual dates for the prediction model. |
| per_shift_income_min | integer | Cents — entered by user at confirmation step |
| per_shift_income_max | integer | Cents — entered by user at confirmation step |
| projected_low | integer | Cents — `per_shift_income_min × parsed_shift_count` |
| projected_high | integer | Cents — `per_shift_income_max × parsed_shift_count` |
| confidence | decimal | 0–1 from Claude vision |
| confirmed_by_user | boolean | Must be true before projection is applied |
| created_at | timestamp | |

**Prediction model note:** Every `schedule_parse` row paired with its `week.income_actual` is a discrete (projected, actual) data point. Over time these rows form a time-series of projection accuracy by week-of-year — the raw material for seasonal income forecasting in Iteration 4.

---

### `classification_config` (constants table, single row, constrained)
| Field | Type | Notes |
|---|---|---|
| id | uuid | Constrained to a single hardcoded UUID via CHECK constraint. Insertion of a second row is a database error. |
| auto_assign_threshold | decimal | Default 0.85 |
| flag_threshold | decimal | Default 0.60 |
| food_weekly_minimum | integer | Cents — default 5000 ($50). Used in deficit trigger as the hard floor. |
| seed_examples | jsonb | Hardcoded merchant classifications for cold-start (see Transaction classification) |

**Single-row constraint:** `ALTER TABLE classification_config ADD CONSTRAINT single_row CHECK (id = '<hardcoded_uuid>');`
Thresholds are stored here (not hardcoded in application logic) so they can be tuned without a code deploy.

---

## Allocation engine

**Runs on: deposit detection, and on provisional week creation at setup.**

### Step-by-step

```
1. Set income_source:
   - If real deposit: income = income_actual
   - If provisional week: income = user.baseline_weekly_income

2. Compute total_fixed_obligations = sum(bill.amount) for all active bills

3. Compute distributable = income - total_fixed_obligations

4. Check deficit trigger (EITHER condition fires deficit):
   Condition A: distributable < income × 0.08  (i.e. bills consume > 92% of income)
   Condition B: distributable - (income × 0.05) - (income × 0.03) < classification_config.food_weekly_minimum
   If either condition is true: → Deficit flow (see below). Stop engine here.

5. Distribute by allocation_pct across all non-bill buckets:
   For each non-bill bucket:
     allocated_amount = distributable × (bucket.allocation_pct / 100)
     Round DOWN to nearest cent.

6. Compute floor amounts for each bucket:
   - Bills: total_fixed_obligations (full amount, always)
   - Debt: max(allocated_amount, income × 0.05)
   - Savings: max(allocated_amount, income × 0.03)
   - Food: max(allocated_amount, classification_config.food_weekly_minimum)
   - Flex: 0 (can zero)
   - Custom: 0 unless user has set a custom floor

7. Compute rounding_residue = distributable - sum(allocated_amounts across all non-bill buckets)
   Add rounding_residue to Savings bucket_allocation.allocated_amount.
   Log rounding_residue on week.rounding_residue.

8. Set opening_allocated_amount = allocated_amount for each bucket_allocation (snapshot for color thresholds).

9. Create bill_status records for each active bill with status = 'unpaid'.

10. Create bucket_allocation records for bills bucket with allocated_amount = total_fixed_obligations.
```

### Provisional week creation (on setup completion)

Run allocation engine with `income = user.baseline_weekly_income`. Create `week` record with:
- `week_start` = most recent Friday on or before today
- `week_end` = following Thursday
- `status = 'projected'`
- `income_actual = null`
- `income_projected_low = user.baseline_weekly_income`
- `income_projected_high = user.baseline_weekly_income`

This provisional week drives all UI until the first real deposit fires. Empty state banner shown on Screen 1.

---

## Bill confirmation re-routing (server-side)

**Trigger:** `bill_status.status` changes to `teller_confirmed` or `manually_confirmed`.

**Runs server-side on status change — not in the frontend.**

```
1. Retrieve bill.amount for the confirmed bill (call this freed_amount)
2. The bills bucket_allocation.allocated_amount is reduced by freed_amount
   (The money is no longer "reserved" — it is available to route)
3. Distribute freed_amount to non-bill buckets in priority_order:
   For each bucket in [Debt, Savings, Food, Flex, ...custom buckets]:
     If bucket has room (allocated_amount < some reasonable ceiling — none in MVP, route fully):
       Add freed_amount to bucket_allocation.allocated_amount
       freed_amount = 0
       Break
4. If freed_amount > 0 after all buckets (edge case: no non-bill buckets): add to Savings
5. Recalculate daily_limit (see formula below)
6. Push updated state to frontend
```

Priority order is fixed in MVP: Debt(1) → Savings(2) → Food(3) → Flex(4) → custom buckets in user-defined order. Cannot be changed in MVP.

---

## Daily spend limit formula

**The single most important number in the app.**

```
daily_limit = sum(unspent_non_fixed_amount) / days_remaining_in_week

Where:
  unspent_non_fixed_amount = sum of (allocated_amount - spent_amount)
                             for all buckets where type != 'bills'
  days_remaining_in_week   = count of days from today through Thursday inclusive
                             Minimum value: 1 (on Thursday, denominator = 1)
```

**Color thresholds** (Screen 1 only — see Screen 2 for separate bucket-level thresholds):
- Green: daily_limit ≥ 30% of `opening_allocated_amount`-derived opening daily limit
- Amber: 10–29%
- Red: < 10%

Opening daily limit = `sum(opening_allocated_amount for non-bill buckets) / 7`

**Note on color system:** Screen 1 and Screen 2 intentionally use different axes.
- Screen 1 measures how much of your *opening daily budget* remains — it answers "am I on track for the week?"
- Screen 2 measures how much of each *bucket's weekly allocation* has been spent — it answers "which category is running hot?"
These are complementary views, not contradictory ones. A green Screen 1 with a red Food bucket means you're on track overall but spending your food money too fast. A developer should not align these systems — the difference is intentional.

---

## Screen specs

### Screen 0 — Setup (first launch only)

**Step 1 — Passkey + recovery**
WebAuthn registration prompt. Biometric enrolled. Immediately below:

"Add a recovery email. If you lose this device, this is how you get back in."

- Recovery email input (required — cannot proceed without it)
- On email entry: 16-character alphanumeric recovery code generated and displayed
- "Write this down. Store it somewhere safe. You will not see it again."
- Checkbox: "I've saved my recovery code" — required to proceed
- `recovery_code_hash` (SHA-256 + salt) and `recovery_email` stored

**Step 2 — Bank connection**
Teller Connect OAuth sheet. Bank of America authentication. On success: enrollment stored. Error: retry button.

**Step 3 — Bills**
Add rows: name, amount (dollars), due day (1–31). At least one required. Validation: amount > 0, due day 1–31, name not blank.

**Step 4 — Budget buckets**
Pre-populated: Debt, Savings, Food, Flex. (Bills is not a percentage bucket — handled by fixed amounts.) User sets percentages for remaining buckets. Running total must equal 100% to proceed. Rename, add custom, or remove Flex (the only removable default). Validation error: "X% unallocated."

**Step 5 — Income baseline + shift range**
- Normal weekly income estimate (dollars)
- Per-shift range: min and max (dollars)
- Validation: min < max, both > 0
- These seed `user.baseline_weekly_income` and the first `schedule_parse` record's range

**Completion**
Provisional `week` record created (allocation engine runs with baseline income).
PWA install banner shown. Navigates to Screen 1.

---

### Screen 1 — Home

**Nominal state**

- **Primary number:** daily spend limit (formula above). Large, centered.
- **Color:** green / amber / red per thresholds above.
- **Secondary row:** three pill indicators:
  - Bills: "X of Y paid" (counts both teller_confirmed and manually_confirmed)
  - Debt: "X% contributed this week"
  - Savings: "X% contributed this week"
- **Tertiary row:** payday countdown. "Payday in 3 days" / "Payday — waiting on deposit" / "This week: $620 deposited"
- **Income line:** actual once deposit clears. "Projected ~$540–$780" before it clears.
- **Deficit banner (conditional):** "Deficit week · [Plan name] active" — persistent, tappable, navigates to Screen 2.

**Offline state**
Cache shown with non-blocking top banner: "Last updated [X] min ago — no connection." Daily number visible with timestamp. Nothing blocked.

**Deposit detected — new week flow**
1. Friday reassignment: transactions from today assigned to prior week → reassigned to new week
2. New `week` record created (or provisional promoted)
3. Allocation engine runs
4. If no deficit: silent recalculation, Screen 1 refreshes
5. If deficit: deficit plan modal appears (cannot be dismissed without selection)

**Deposit false-positive correction**
Banner: "Wrong deposit detected — tap to correct." Bottom sheet shows the flagged transaction. "This is not my paycheck" sets `is_direct_deposit = false`, triggers re-evaluation of all Friday transactions against detection criteria.

**Manual deposit confirmation flow**
Trigger: no qualifying deposit detected by end-of-day Friday.
Banner: "Expected deposit not detected — tap to confirm manually."
On tap: transaction list shown (most recent first, credits only, from past 48 hours).
User selects the correct transaction.
On selection:
- `transaction.is_direct_deposit = true`
- `week.payday = transaction.posted_at date`
- `week.income_actual = transaction.amount`
- `week.status = 'active'`
- Allocation engine runs with `income_actual`
- If user selects a non-deposit by mistake: same false-positive correction banner appears, allowing correction

**Empty state (provisional week, before first deposit)**
Daily limit shown from baseline estimate. Banner: "Waiting for first deposit — showing estimate."

**Error states**
- Teller sync failed: inline banner "Bank sync issue — tap to reconnect." Non-blocking.
- Teller disconnected: banner "Bank disconnected — tap to reconnect." Data preserved.

---

### Screen 2 — Budget buckets

**Color system (Screen 2 only):**
Bucket color reflects % of weekly allocation spent — different from Screen 1 (see color system note above).
- Green: < 60% of weekly allocation spent
- Amber: 60–89% spent
- Red: ≥ 90% spent

This means you can have a green daily limit on Screen 1 (on track for the week) and a red Food bucket on Screen 2 (spending food budget faster than other categories). This is intentional and correct — it gives more information, not conflicting information.

**Bills bucket (distinct rendering)**
Renders as a list of individual bill rows, not a single progress bar. Each row:
- Bill name + amount + due date
- Status: grey dot (unpaid) / green checkmark (confirmed)
- "Mark as paid" button — always visible, always tappable, regardless of Teller state
- If Teller auto-confirmed: "Teller confirmed [date]" replaces button
- If user marked paid: "Marked paid [date]" shown
- Both paths update `bill_status` and trigger server-side re-routing

**Non-bill bucket cards**
Each shows: label, progress bar (filled = spent), "$X spent · $Y remaining," % of allocation used, color per threshold above.

**Tap to expand — transaction detail**
Transactions for current week: merchant name, amount, date, classification label.
- Confidence < 0.85: confidence indicator shown (e.g. "85% sure — Food")
- Flagged transactions (0.60–0.84): "Confirm?" badge
- Tapping opens bottom sheet: current assignment shown, all buckets listed for reassignment. Override stored.

**Uncategorized section**
Transactions with `classification_confidence < 0.60` shown here. Count shown as badge on Screen 2 tab. User must assign each manually.

**Unallocated buffer**
Muted small text at bottom: "Rounding buffer: $X.XX" — always near $0. Any residue was already routed to Savings by the allocation engine; this line is display-only confirmation.

---

### Screen 3 — Projection + history

**Top section — next week projection**

Current projection: "Next week: $540–$780 · Budget baseline: $540"

"Update from schedule" button → image picker → upload → Claude vision API called.

**Parse success (confidence ≥ 0.70):**
Confirmation card (nothing applied until user confirms):
- Shifts listed: "4 shifts — Mon, Wed, Fri, Sat"
- Per-shift range: pre-filled from most recent `schedule_parse`, editable
- Projected totals: "Low $480 · High $880 · Baseline $480"
- Confirm / Edit buttons

**Parse low confidence (< 0.70):**
"Couldn't read your schedule clearly — enter shifts manually." Integer input for shift count + editable range. Same confirmation flow.

**Parse failure:**
"Something went wrong — try a clearer screenshot or enter shifts manually." Manual fallback always available.

**On confirmation:**
- `schedule_parse` record created with `confirmed_by_user = true`
- `week.income_projected_low/high` updated for the target week
- No retroactive change to current week allocations

**Bottom section — history**

Closed weeks, most recent first. Each row: date range, actual income, deficit plan (if any), total spent vs allocated. Tap to expand: bucket-level breakdown. No graph in MVP — data stored for Iteration 4.

Empty state: "Your history will appear here after your first full week."

---

## Deficit flow

### Trigger (either condition fires deficit)

```
Condition A: income_actual < bill_total / 0.92
  (i.e. bills consume more than 92% of income)

Condition B: income_actual - bill_total - (income_actual × 0.05) - (income_actual × 0.03) < food_weekly_minimum
  (i.e. after floors for debt and savings, less than $50 remains for food)

Deficit fires if: Condition A OR Condition B is true
```

### Three plans — modal, cannot be dismissed without selection

The deficit modal is the **single intentional exception** to design principle #3 ("no decisions required"). Choosing no plan is itself a plan — and a worse one. The modal forces a decision because the alternative is silently running on wrong allocations.

Each plan shows a full dollar-by-dollar breakdown for this specific week.

**Optimal**
- Bills: 100% of fixed total
- Debt: full user-set allocation if distributable allows, otherwise floor (5%)
- Savings: full user-set allocation if distributable allows, otherwise floor (3%)
- Food: trimmed proportionally to close remaining gap
- Flex: cut first, may reach $0
- Use when: slightly short week, wants to protect habit targets

**Emergency**
- Bills: 100%
- Debt: floor only — `income_actual × 0.05`
- Savings: floor only — `income_actual × 0.03`
- Food: `income_actual - bill_total - debt_floor - savings_floor` (remainder, minimum $50)
- Flex: $0
- Use when: bad week. Nothing extra anywhere.

**Long-term responsible — algorithm**

```
1. distributable = income_actual - bill_total
2. target_reduction = sum(normal non-bill allocations) - distributable
3. uniform_cut_pct = target_reduction / sum(normal non-bill allocations)
4. For each non-bill bucket:
     proposed = bucket_normal_allocation × (1 - uniform_cut_pct)
     If proposed < floor_amount: set to floor_amount, carry overage
5. Distribute overage as additional cut: Flex first, then Food
6. If Flex and Food are both at floors and deficit still unresolved:
     This plan cannot close the deficit — fall through to Emergency automatically.
     Notify user: "Your income this week requires Emergency plan. Long-term responsible isn't possible."
7. Verify: sum(all proposed allocations) = distributable. If not: adjust Flex by residue.
```

- Use when: manageable deficit, wants all habits preserved at reduced levels

### Floor enforcement (all plans)
| Bucket | Floor |
|---|---|
| Bills | 100% of fixed total — cannot be reduced |
| Debt | `income_actual × 0.05` |
| Savings | `income_actual × 0.03` |
| Food | `max(remainder, classification_config.food_weekly_minimum)` — $50 minimum |
| Flex | $0 |

### Insolvent week state
Trigger: `income_actual < bill_total + (income_actual × 0.05) + (income_actual × 0.03) + food_weekly_minimum`

No plan selection. Single state:
"This week's income doesn't cover your fixed obligations. Bills are protected. All discretionary spending is paused."

- Bills: covered in full
- Debt: 5% floor
- Savings: 3% floor
- Food: $50 minimum if any income remains after above; otherwise $0 with explicit display
- Flex: $0

### Post-selection (all plans)
`week.deficit_plan` stored. `deficit_plan_expires_at = week_end`. If second deposit arrives mid-week: plan expires immediately, allocation engine re-runs, deficit re-evaluated. Screen 1 persistent banner for week duration.

---

## Transaction classification

### Pipeline

```
1. Transaction arrives via Teller webhook. Stored raw (bucket_id = null).

2. Assemble few-shot context:
   - Take user's most recent confirmed classifications (up to 10)
   - If count < 10: pad with seed_examples from classification_config
     until 10 examples total
   - This handles cold-start — first transaction uses all seed examples

3. Call Claude API:
   Input: merchant_name, amount, description, bucket definitions, 10 examples
   Output: { bucket_id, confidence, rationale }

4. Route by confidence:
   ≥ auto_assign_threshold (0.85): auto-assign, no user prompt
   ≥ flag_threshold (0.60) and < 0.85: assign + show "Confirm?" badge on Screen 2
   < 0.60: bucket_id = null, shown in Uncategorized section

5. Store result. User overrides stored and appended to future few-shot context.
```

### Seed examples (cold-start, stored in `classification_config.seed_examples`)
Pre-built classifications for common merchant types:
- DoorDash, Uber Eats, Grubhub, Instacart → Food or Flex (amount-based heuristic: > $30 = Food, ≤ $30 = Flex)
- Chevron, Shell, BP, ExxonMobil → Flex
- Whole Foods, Trader Joe's, Kroger, Safeway, Aldi → Food
- Utility keywords (ConEd, PG&E, "Electric", "Gas", "Water", "Internet") → Bills
- Minimum payment keywords ("minimum payment", "autopay") → Debt

### Direct deposit detection
Flag `is_direct_deposit = true` if ALL of:
- Amount is positive
- Description contains: "direct deposit", "payroll", "ACH credit", or "direct dep" (case-insensitive)
- Amount ≥ `user.baseline_weekly_income × 0.60` (no upper cap)
- Posted on a Friday (primary). If Friday passes with no detection: window expands to Saturday and Sunday before "not detected" prompt fires.

---

## Claude vision spec (schedule parsing)

**Prompt:**
```
You are parsing a restaurant employee scheduling app screenshot.
Extract the total number of shifts and the day of week for each shift.
The image may be from any scheduling platform (7shifts, HotSchedules, When I Work, Toast, or other).
If the layout is unfamiliar or unclear, return a low confidence score rather than guessing.
Return JSON only — no text before or after:
{
  "shift_count": <integer>,
  "shift_days": <array of strings, e.g. ["Mon", "Wed", "Fri"]>,
  "confidence": <float 0-1>
}
```

Confidence < 0.70 → manual fallback (integer shift count input). Manual fallback always available regardless of confidence.

**Note on scheduling apps:** Resy is a guest reservation platform, not a scheduling tool. Supported employee scheduling apps are: 7shifts, HotSchedules, When I Work, Toast scheduling module. The prompt is written to degrade gracefully on any unfamiliar layout rather than assuming a specific format.

---

## Auth flow

**First launch:** WebAuthn registration. Recovery email + one-time code collected in same step. See Setup Screen 0 Step 1.

**Returning launch:** WebAuthn assertion challenge. Biometric prompt. JWT issued (7-day expiry). Silent re-auth via bottom sheet on expiry — screen state preserved, no navigation.

**Account recovery:**
"Lost access? Recover account" link on login screen.
Flow: enter recovery email → enter 16-char recovery code → on match, new passkey registration on new device → old `passkey_credential_id` invalidated → new recovery code generated and displayed (single-use replaced).

---

## Teller integration contract

**Endpoints:**
- `GET /accounts` — setup confirmation
- `GET /accounts/{id}/balances` — every 4 hours
- `GET /accounts/{id}/transactions` — every 30 minutes; webhook preferred
- Webhook: `transaction.created` → immediate classification pipeline

**Error matrix:**

| Teller error | App behavior |
|---|---|
| 401 unauthorized | Non-blocking banner: reconnect prompt |
| 429 rate limit | Exponential backoff, no user error unless > 1hr |
| 500 server error | Retry 3×, then banner: "Bank sync delayed" |
| Enrollment disconnected | Reconnect prompt, all data preserved |
| Transaction gap | No action — filled on next successful poll |

---

## Weekly rhythm

| When | Action | Time |
|---|---|---|
| Friday (automatic) | Deposit detected → Friday reassignment → allocation engine → deficit modal if needed | 0 sec |
| Weekly (optional) | Upload schedule screenshot → confirm shifts + range → projection set | 60 sec |
| Daily | Open app, see daily limit | 5 sec |
| Bill clears (automatic) | Teller confirms → server-side re-routing → daily limit recalculates | 0 sec |
| Bill (manual) | Tap "Mark as paid" on any bill | 5 sec |
| Anytime | Confirm or reassign flagged transaction | 10 sec |

---

## Setup flow

1. Passkey (Face ID / Touch ID) + recovery email + one-time recovery code
2. Connect Bank of America via Teller Connect (~2 min)
3. Enter bills: name, amount, due day
4. Set bucket percentages (post-bills remainder) — must total 100%
5. Enter income baseline + per-shift range
6. Provisional week created automatically
7. Save to home screen

---

## Tech stack

| Layer | Tool | Cost |
|---|---|---|
| Frontend | Next.js (React) — PWA | Free |
| Auth | WebAuthn / Passkey — browser-native | Free |
| Bank sync | Teller.io — BoA, direct API + webhooks | Free (100 connections) |
| Database + storage | Supabase | Free tier |
| Hosting | Vercel | Free tier |
| Transaction classification | Claude API (claude-sonnet) — ~$0.001/transaction | Pay per use, negligible |
| Schedule parsing | Claude API vision — ~once/week | Pay per use, negligible |
| **Total monthly cost** | | **~$0** |

---

## What is explicitly NOT in the MVP

| Feature | When | Note |
|---|---|---|
| Strike system | Iteration 2 | |
| Delivery category on home screen | Iteration 2 | |
| Late-night mode (11pm–4am high-contrast red) | Iteration 2 | |
| Push notifications | Iteration 2 | |
| Chaos mode | Iteration 3 | |
| Tonight cap | Iteration 3 | |
| Week-over-week graph | Iteration 4 | Data stored from day one |
| Income prediction model | Iteration 4 | Data architecture in place from day one |
| Pattern recognition | Iteration 4 | |
| Savings streak | Iteration 4 | |
| Native React Native app | Iteration 4 | |

**Named build task — service worker stub:** Register a PWA service worker during MVP build for offline caching. Do not wire push notification logic yet. Without this stub, Iteration 2 push notifications require an architecture change rather than an additive build. This is a named task, not a footnote.

---

## Iteration roadmap

### Iteration 2 — friction layer
- Strike system: daily limit breach → warning banner → hourly push notifications → automatic transfer to locked savings sub-bucket
- Delivery category: auto-classified, surfaced as explicit line item on home screen
- Late-night mode: high-contrast red UI 11pm–4am, larger numbers, reduced navigation
- Push notifications via registered service worker stub

### Iteration 3 — resilience
- Chaos mode: significantly below-projection deposit detected → one-tap survival budget with explicit trade-off display
- Tonight cap: spending ceiling set before going out, real-time watch with alerts at 80% and 100%

### Iteration 4 — intelligence
- Week-over-week graph on Screen 3
- Income prediction model: rolling actuals by week-of-year, seasonal pattern detection (slow January, holiday peak, etc.), 4-week and 12-week income forecasts, natural language insight cards
- Savings streak counter
- Native React Native app

---

## Key design principles

1. **Never require reconfiguration** — income is detected automatically. Everything recalculates without user input.
2. **One number does the work** — the home screen shows your daily limit. That is the only number that matters at 2am.
3. **Designed for impaired judgment** — readable and actionable after a shift. No charts, no categories to navigate, no decisions required *unless a deficit forces one* (see principle 5).
4. **Consequences are automatic** — (Iteration 2) money moves before you can rationalize. Notifications can be ignored. Real money cannot.
5. **Deficit honesty** — when the week is short, the app tells you immediately and forces a plan selection. The deficit modal is the single intentional exception to principle 3: choosing no plan is itself a plan, and a worse one. If the week is insolvent, the app says so plainly.
6. **Trust through confirmation** — Claude classifies transactions automatically. Low-confidence calls surface for user confirmation. The system earns trust incrementally.
7. **Data accumulates with intent** — every schedule parse, every deposit, every closed week is a data point. The app is a prediction engine from day one, even before the predictions are shown.
