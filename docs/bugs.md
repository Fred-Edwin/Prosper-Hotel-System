# Bugs — Prosper Hotel

Intake log for `/fix`. Log a bug here as soon as it's found — what was
asked/reported, by whom, when — even before triage decides how it gets
fixed. Nothing gets fixed off a bug that only exists in conversation.

Format, one entry per bug:

```markdown
## BUG-<NN>: <short title>
**Severity:** critical | high | normal | low
**Discovered:** <how — client report, production error, manual testing>
**Status:** open | in-progress | fixed

### Description
What's broken.

### Repro steps
1. ...

### Expected vs actual
...
```

## BUG-01: Non-financial corrections don't retain the previous value
**Severity:** normal
**Discovered:** pre-handoff verification pass (proposal.md coverage audit),
2026-08-12
**Status:** open

### Description
proposal.md §8: "Non-financial corrections — a misspelled name or an
incorrect telephone number — are amended directly, with the previous
value retained." §9's Activity record also requires that "where a record
has been amended, the record shows that it was amended, by whom, and its
previous value."

`updateStaffMemberRecord`/`updateCustomerRecord`
(`src/modules/people/queries.ts`) currently overwrite `name`/`phone` in
place. There is no history table or previous-value column, and nothing
in `getActivity` (`src/modules/reporting/logic.ts`) can surface that a
name/phone was ever changed, let alone what it changed from.

**Update 2026-08-18 (editable-ledger T10).** The missing half now exists:
the editable-ledger work added the `Amendment` model and
`recordAmendment` (`people/logic.ts`), which record exactly what this bug
asks for — what changed, from what, to what, by whom, when — and
`getActivity` already surfaces amendment rows. **The bug is still open**:
`updateStaffMemberRecord` and `updateCustomerRecord` were never wired to
call it, so name/phone edits remain untracked. What was a modelling
problem is now a small wiring job against an existing seam.

### Repro steps
1. Edit a staff member's or customer's name or phone number.
2. Check the Activity record (reporting) for that person.

### Expected vs actual
Expected: the amendment appears in the activity trail, showing old and
new values and who made the change.
Actual: the record is silently overwritten; no trace of the previous
value exists anywhere.

### Notes
Needs a schema decision (a history/correction table, or previous-value
columns on `StaffMember`/`Customer`) — deliberately not fixed as part of
the pre-handoff verification pass since it's schema-level work, not a
same-shape fix to the three permission/reporting gaps found alongside
it. Triage via `/fix` when ready.

## BUG-02: Root URL doesn't redirect to login
**Severity:** high
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed — 2026-08-13

### Description
Visiting the app's root URL does not redirect to `/login`. Instead it
loads a placeholder page reading "Prosper Hotel — Design phase. Variants
are mounted per screen."

### Repro steps
1. Navigate to the app's root URL (e.g. `localhost:3000` or the deployed
   domain) while logged out.

### Expected vs actual
Expected: redirected to the login page (name + 4-digit PIN, per ADR
0007), since that's the entry point for every user.
Actual: a leftover design-phase placeholder page is shown at the root
URL; there is no redirect to login.

### Fix
`src/app/page.tsx` now calls `getSession()` and redirects: no session →
`/login`, owner → `/dashboard`, everyone else → `/staff` (same
convention as `dashboard/page.tsx`'s own redirect). Verified live for
both logged-out and logged-in (attendant) cases.

## BUG-03: "Today's sales" and "Handover" pages stuck on skeleton forever
**Severity:** high
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed — 2026-08-13

### Description
Both `src/modules/sales/ui/todays-sales.tsx` and
`src/modules/cash/ui/handover.tsx` never resolve out of their loading
skeleton for staff. Investigation traced both to real, existing routes
(`GET /api/sales/today` → `todaysSalesRoute`,
`GET /api/handovers/today` → `todaysHandoverRoute`) and their underlying
logic (`listTodaysSalesForStaff`, `getTodaysHandoverForStaff`), which
look structurally sound on read — no obvious missing `await`, no
unhandled throw, no 404, no interfering middleware. The `catch` blocks
resolve to an error state rather than infinite loading, so a plain
exception shouldn't cause this on its own.

### Repro steps
1. Log in as any staff member.
2. Open "Today's sales".
3. Open "Handover".

### Expected vs actual
Expected: both pages load real data (or a proper empty/error state).
Actual: both are stuck indefinitely on the loading skeleton.

### Notes
Static reading didn't surface a root cause — needs a live repro with
browser dev tools (Network tab status/response for both calls, and the
JS console for an exception firing before the fetch effect runs).
Possibly related to BUG-06 (container attendance stock-taking page also
blank) — worth checking whether all three share one cause.

### Fix
Root cause found live via Playwright: both components used a shared
`cancelledRef = useRef(false)`, set `true` by the effect's cleanup, but
**never reset back to `false`** on the next run. React StrictMode's
dev-only mount → unmount → remount cycle fires that cleanup
synchronously right after the first mount, poisoning the ref before the
in-flight fetch even resolves — every `setState` after that point,
including the real one, was silently skipped because
`cancelledRef.current` stayed `true` forever. Confirmed with a temporary
console trace, not just theorized.

Fixed by replacing the ref with a `cancelled` variable local to each
effect invocation (the pattern `record-stock-count.tsx` already used
correctly) in `todays-sales.tsx` and `handover.tsx`.

**Not the same root cause as BUG-06** — see that entry below.

**A third screen had the identical bug and was not one of the six**:
`src/modules/cash/ui/takings.tsx` used the exact same broken
`cancelledRef` shape and was also stuck on skeleton forever for every
role. Fixed alongside these two since it's the same one-line-class fix,
verified live as the canteen attendant. Flagging it here rather than
silently expanding scope.

Audited every other `cancelledRef` user in the codebase (17 files) —
all the others correctly reset `cancelledRef.current = false` at the
top of the effect body on every run, so they were never affected. This
appears to be an isolated copy-paste slip in exactly these three files,
not a systemic pattern across the app.

Regression coverage: this is UI-effect timing, not covered by the
integration test suite (which doesn't render React components) —
verified live instead, per the note above. No new test added; consider
an E2E smoke check if this class of bug recurs.

## BUG-04: Store manager sale fails with 403 "Couldn't complete the sale"
**Severity:** high
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed — 2026-08-13

### Description
`recordCounterSale` (`src/modules/sales/logic.ts:171-173`) rejects any
sale from a `store_manager` role unless `fulfilment === "delivery"`:
```
if (requester.staff.role === "store_manager" && fulfilment !== "delivery") {
  return { ok: false, reason: "forbidden" };
}
```
This maps to `POST /api/sales` returning 403. The comment above it cites
proposal.md — store managers aren't meant to have counter-sale access —
but the UI (`src/modules/sales/ui/new-sale.tsx:238,390-421`) defaults
`fulfilment` to `"counter"` and renders the Counter/Delivery toggle
identically for every role, with no restriction or explanation for
store managers. So a store manager hits the block by default, with a
generic "check payment and try again" message that gives no indication
the real issue is their role.

### Repro steps
1. Log in as a store manager.
2. Start a new sale, leave fulfilment on the default "Counter" mode (or
   don't touch the toggle).
3. Submit the sale.

### Expected vs actual
Expected: either store managers can make counter sales (if the
proposal.md restriction is wrong/outdated), or the UI hides/disables
Counter mode for store managers and explains why, rather than a generic
payment-failure error.
Actual: silent 403 with a misleading "check payment and try again"
message.

### Notes
Needs a product decision: is "store manager can't do counter sales"
still correct per current scope? If yes, fix is UI-side (hide/disable
Counter for this role, clearer messaging). If no, fix is the permission
check itself.

### Fix
Product decision confirmed (Edwinfred): the restriction is correct and
stays; `sales/logic.ts:171-173` untouched. Fixed UI-side in
`new-sale.tsx`: `role` is now plumbed down from `staff-page-client.tsx`
through `NewSale`/`NewSaleView`/`Till`. For `store_manager`, fulfilment
defaults to `"delivery"` instead of `"counter"`, the Counter toggle is
disabled with a `title` tooltip explaining why (matching the existing
`title`-attribute pattern already used in this file for product tiles —
no `Tooltip` primitive was introduced), and the submit-error message is
role/mode-aware ("Store managers record delivery orders, not counter
sales" instead of the generic message) if a 403 is still reached via
direct API call. Verified type-check clean; the counter-sale permission
check itself was not touched.

## BUG-05: Production entry page replaces instead of adding line items
**Severity:** high
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed — 2026-08-13

### Description
`src/modules/stock/ui/record-production.tsx` holds a single selected
product and a single quantity in state instead of a list:
```
const [selected, setSelected] = useState<Product | null>(null);  // line 150
const [quantity, setQuantity] = useState("");                    // line 151
```
Clicking a product tile (`onClick={() => setSelected(p)}`, line 223)
overwrites `selected` with the newly clicked product, discarding
whatever was previously selected — and `quantity` is shared across
selections rather than per-product. There's no lines-array/basket
pattern like `record-stock-count.tsx` already uses (`Line[]` keyed by
item id, with `add`/`remove`/`setQuantity`, lines 171-188), which is the
correct pattern this screen is missing.

### Repro steps
1. Log in as store manager, open Productions.
2. Click "Chips", enter quantity 10.
3. Click "Rice plate".

### Expected vs actual
Expected: both Chips (qty 10) and Rice plate become separate line
entries, both submitted together.
Actual: the Chips entry is discarded; only Rice plate remains selected.

### Notes
Relatedly, the user only saw 2 products (Chips, Rice plate) on this
screen, but seed data (`prisma/seed.ts`) actually creates 3 active
`cooked_food` products including "Mukimo" (line 146). The filtering
logic (`record-production.tsx:44`, `catalogue/routes.ts:62-68`) doesn't
show an obvious reason Mukimo would be excluded — worth confirming live
whether it's actually missing or was just not scrolled to/noticed.

### Fix
Ported the `Line[]` add/remove/setQuantity pattern from
`record-stock-count.tsx` into `record-production.tsx` — multiple
products can now be selected into a basket, each with its own quantity,
submitted together.

The submit path needed a second layer, exactly as anticipated: the
server (`recordProduction` in `stock/logic.ts`, `/api/stock/produce`)
only accepted one `productId`/`quantity` pair, unlike `issue-to-kitchen`
and stock-counts' real `lines[]` APIs that commit atomically. Rather
than a UI-only workaround (firing N sequential single-item requests,
which loses atomicity — a mid-batch failure would leave some products
recorded and others not), extended `recordProduction`/
`recordProductionRoute` to accept `lines: { productId, quantity }[]`,
mirroring `recordIngredientIssue`'s exact shape: validate every line
upfront, fail the whole batch on any invalid line, then commit all
lines together. Confirmed with the user before expanding into the logic
layer.

Mukimo check: confirmed live via API call after a fresh reseed — all 3
active `cooked_food` products (Chips, Mukimo, Rice plate) are returned
by `/api/catalogue/products/active`. **Not a real bug** — the original
QA pass most likely just didn't notice the third tile.

Regression: `stock/tests/production.integration.test.ts` updated to the
new `lines[]` signature (all 8 existing cases) plus two new cases —
multi-line submission recording both movements correctly, and a
batch-level rejection (no recipe on one line) leaving nothing recorded
for any line. All pass.

## BUG-06: Container/canteen attendant stock-taking page is blank
**Severity:** high
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** could not reproduce — 2026-08-13

### Description
`stock-count.tsx` → `record-stock-count.tsx` renders blank for the
canteen attendant. Its data fetch (`fetchCountableItems`, lines 36-70)
calls `/api/catalogue/products/active` and
`/api/catalogue/ingredients/active` in parallel; both routes exist and
loading/error/empty states are handled in the component (lines
138-159). "Blank" could mean either the stuck-loading skeleton (same
class of issue as BUG-03) or a legitimate `EmptyFirstUse` empty state
("Nothing to count yet") if the ingredients-active endpoint is
returning nothing for this role/location.

### Repro steps
1. Log in as canteen attendant.
2. Open Stock Taking.

### Expected vs actual
Expected: countable products/ingredients listed for entry.
Actual: blank page.

### Notes
Needs a live repro to tell stuck-loading apart from a genuine empty
result — specifically check whether
`GET /api/catalogue/ingredients/active` errors or 403s for this role.
Possibly the same root cause as BUG-03.

### Investigation
Could not reproduce live via Playwright, logged in as Canteen Attendant,
tried twice (once mid-session, once again after a full `pnpm seed`
reseed and fresh login to rule out stale local data). Both times: the
page rendered correctly with the full product/ingredient grid,
`GET /api/catalogue/products/active` and
`GET /api/catalogue/ingredients/active` both returned 200 with populated
bodies, no 403, no console error.

**Does not share BUG-03's root cause.** `record-stock-count.tsx` (the
component this screen actually uses) already used the correct
closure-scoped `cancelled` variable pattern, not the broken
`cancelledRef` — confirmed by reading the code before ruling it out.
`activeIngredientsRoute` (`catalogue/routes.ts:123`) also has no role
gate at all, only a session check, so a role-based 403 isn't possible
for any authenticated staff member either.

Best guess: this was most likely a misattributed symptom of BUG-03's
bug — the attendant may have hit a poisoned skeleton on a different
screen (Today's sales, Handover, or Takings, all confirmed broken by
the same `cancelledRef` bug) during the original QA pass, and it got
logged against Stock Count instead. Leaving as "could not reproduce"
rather than marking fixed, since there's nothing to point to as the fix
— if it recurs, worth re-testing with the exact repro steps and noting
which screen was open immediately before.

## BUG-07: Canteen transfer-stock page only lists office-supply seed items
**Severity:** normal
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** open

### Description
The canteen attendant's "transfer stock" screen shows only "Photocopy"
and "Printing paper" as transferable items. The query behind the page,
`getTransferableItems` (`src/modules/stock/logic.ts:323-348`), correctly
scopes to `locationId` and returns every active item with
`quantityOnHand > 0` — no incorrect filter found. This is a seed-data
problem, not application logic: `prisma/seed.ts` seeds "Printing paper
(ream)" and "Photocopy (per page)" as canteen stock (lines 151, 155,
256-261) alongside "Biscuits (packet)" — office-supply-flavoured
placeholder items rather than a realistic canteen product range, which
is why the transfer list looks wrong/limited.

### Repro steps
1. Log in as canteen attendant.
2. Open Transfer Stock.

### Expected vs actual
Expected: any product held in canteen stock should be transferable to
the restaurant.
Actual: transfer logic is correct, but only 2-3 items exist in canteen
seed data, giving the impression the feature is broken/limited.

### Notes
Confirm with the client whether canteen should transfer any product
type, then fix by expanding/correcting seed data (see also BUG-08 —
biscuits ledger issue — both point at canteen seed data needing a
pass).

## BUG-08: Admin stock page shows only the latest count, no history
**Severity:** normal
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** open

### Description
`src/modules/stock/ui/admin-stock-table.tsx` (`fetchStock`, lines
105-163) only calls current-state endpoints (`/api/stock/:locationId`,
`.../value`, `.../ingredient-value`, `.../low-stock`) — all "as of now"
reads with no date/period parameter. There is no historical-counts view
wired into this screen at all; this is a feature gap, not a regression
in existing logic.

### Repro steps
1. Log in as admin/owner, open the Stock page.

### Expected vs actual
Expected: a way to see past stock counts over time, not just the
current snapshot.
Actual: only the latest count is ever visible.

### Notes
Needs scoping (new screen or a history panel/filter on the existing
one) — route through `/add` or `/tickets` rather than a quick fix, since
it's new functionality, not a defect in existing behavior.

## BUG-09: Admin Activity page timestamps are unformatted raw ISO strings
**Severity:** normal
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed — 2026-08-13

### Description
The "Recorded" and "For the day" columns on the admin Activity page
render raw, unformatted values. `reporting/logic.ts` builds
`enteredAt`/`effectiveOn` as `Date` objects (e.g. lines 1728-1729,
1743-1744, 1757-1758), which `routes.ts:352` serializes straight to JSON
(→ full ISO-8601 strings like `2026-08-13T14:32:07.123Z`).
`reporting/ui/activity.tsx` then renders them with no formatting at
all: `<span>{r.enteredAt}</span>` (line 249) and
`<span>{r.effectiveOn}</span>` (line 269) — unlike other date displays
in the codebase (e.g. `admin-stock-table.tsx`'s `formatAsOf`,
`todays-sales.tsx`'s `time()` helper). The component's own `backdated`
check (line 257) already assumes these are short date strings, implying
the formatting step was simply never added.

### Repro steps
1. Log in as admin, open Activity.

### Expected vs actual
Expected: human-readable date/time (e.g. "13 Aug 2026, 2:32 PM").
Actual: raw ISO-8601 timestamp strings.

### Notes
Straightforward fix — format both columns with the same date/time
helper used elsewhere in the codebase before rendering.

### Fix
Neither existing helper fit alone — `admin-stock-table.tsx`'s
`formatAsOf` is date-only, `todays-sales.tsx`'s `time()` is time-only —
so added one new `formatDateTime` helper local to `activity.tsx`
combining both (e.g. "13 Aug, 2:32 PM"), applied to both the "Recorded"
and "For the day" columns.

While fixing this, found and fixed a second, related bug in the same
lines: the `backdated` check at (then) line 257 compared
`r.effectiveOn !== r.enteredAt.slice(0, 10)` — but `effectiveOn` is a
full ISO-8601 string (a `Date` serialized by `Response.json`), not a
10-character date-only string, so that comparison was **always true**,
flagging every single row as backdated regardless of whether it
actually was. Fixed by comparing `r.effectiveOn.slice(0, 10)` against
`r.enteredAt.slice(0, 10)` — the date portions of both raw ISO values —
rather than against the (now human-formatted) display string, so the
formatting change doesn't break this check going forward either.

## BUG-10: Product Ledger double-counts canteen sales as "sold" (102 vs actual 2)
**Severity:** critical
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** closed — superseded, 2026-08-13. Not patched; the design it exposed was
replaced instead. See `docs/scope.md`'s 2026-08-13 "Canteen: real sales,
two-sided transfers, retiring count-derived sales" entry. The count-derived-sales
mechanism this bug lives in (`recordCountDerivedSales`, the `sold_derived`
movement reason) is being removed entirely, not fixed — there is no formula patch
to verify once that code is gone.

### Description
The canteen ledger showed 102 biscuit packets "sold" on 2026-08-13, but
the Activity page filtered to sales + canteen attendant shows only one
real sale of 2 packets. Root cause: `foldReasonLines`
(`reporting/logic.ts:945`) sums two different movement reasons into one
"sold" total:
```
else if (line.reason === "sold" || line.reason === "sold_derived") sums.sold += -line.quantity;
```
`"sold_derived"` movements come from `recordCountDerivedSales`
(`stock/logic.ts:1080-1193`), triggered on canteen stock counts
(`:1048-1051`). Its formula
(`previousCounted + received + transferredIn − creditSold − wasted −
consumed − givenAway − transferredOut − countedQuantity`, lines
1168-1177) only subtracts **credit** sales — it never accounts for real
cash `"sold"` movements already recorded through the till
(`recordCounterSale` writes `reason: "sold"`, `sales/logic.ts:138-146`).
The design assumption at `stock/logic.ts:1044-1047` — "individual sales
aren't recorded [at the canteen]" — is false; the canteen attendant can
and does record real per-item sales. So the shrinkage caused by a real
cash sale gets inferred again as `sold_derived` at the next stock count,
and `foldReasonLines` adds both the real `"sold"` movement and the
inferred `"sold_derived"` movement together, wildly inflating the
ledger total.

### Repro steps
1. As canteen attendant, record a sale of a few biscuit packets (cash).
2. Do a stock count that reflects the resulting on-hand quantity.
3. Check the Product Ledger for biscuits for that day vs. the Activity
   page filtered to sales.

### Expected vs actual
Expected: ledger "sold" total matches the sum of actual recorded sales.
Actual: ledger total (102) is far higher than actual sales (2) because
the same shrinkage is counted twice — once as a real sale, once as an
inferred derived sale.

### Notes
Fix needs to make `recordCountDerivedSales` also net out real `"sold"`
movements already recorded since the previous count (not just credit
sales), so it only infers sales for shrinkage that isn't already
explained by recorded till sales. Financial/inventory-accuracy bug —
flagging critical.

## BUG-11: Customer repayment always rejected as "more than they owe"
**Severity:** critical
**Discovered:** manual testing (Edwinfred), 2026-08-13
**Status:** fixed

### Description
Recording a customer repayment from the admin People page always fails
with "exceeds balance," even for amounts genuinely less than the
balance owed. Root cause is a unit mismatch:
`src/modules/people/ui/customer-detail.tsx:57` does
```
const amountMinor = Math.round(Number(amount) * 100);
```
treating the typed shilling amount as if it needs cents conversion. But
this codebase's `*Minor`-suffixed fields are **not** cents — they're
plain whole shillings throughout (`src/shared/money.ts`'s `money()`
formats `n` directly with no `/100`; seed prices like `priceMinor: 80`
in `prisma/seed.ts:145` are plain shilling amounts). The backend
(`recordRepayment`, `sales/logic.ts:291-293`) compares the ×100-inflated
`amountMinor` against a correctly-unscaled `balance`
(`getCustomerBalance`, plain-shilling sums in `sales/queries.ts:80-116`),
so almost any repayment amount trips the `exceeds_balance` check (e.g.
balance 500, typed "500" → sent as 50000).

### Repro steps
1. Log in as admin, open People → Customers → a customer with a
   balance owed.
2. Record a repayment for less than (or equal to) the balance shown.

### Expected vs actual
Expected: repayment succeeds when the amount is ≤ balance owed.
Actual: always rejected as exceeding balance, because the UI sends an
amount 100x too large.

### Notes
Fix: remove the `* 100` conversion in `customer-detail.tsx:57` — send
the typed shilling amount directly, matching every other `*Minor` field
in the codebase. Financial-correctness bug — flagging critical.

Separately, while investigating this, found that `sumCreditForCustomer`
(`sales/queries.ts:80-86`) doesn't exclude voided sales' `PaymentLine`
rows (`markSaleVoided`, `sales/queries.ts:11-21`, never touches
`PaymentLine`) — this would make balances too *high*, not too low, so
it isn't the cause of this bug, but may be worth its own bug entry if a
voided credit sale should stop counting toward what a customer owes.
See BUG-12 below — confirmed during the Phase 2 financial review.

### Fix (2026-08-13)
Removed the `* 100` in `customer-detail.tsx:57` — the typed shilling
amount is now sent to `recordRepayment` unscaled. Added a short comment
to `src/shared/money.ts` stating the unit convention explicitly (every
`*Minor` field is whole shillings, nothing should scale by 100) so the
next person confused about units finds the answer there. Regression
test: `sales/tests/sales.integration.test.ts` — "a repayment of exactly
the balance owed succeeds and zeroes the balance," alongside the
existing "rejects an amount larger than the current balance" test, so
both halves of the guard are covered. Verified live: repaid a seeded
customer's full KSh 300 balance from the People → Customers page;
balance dropped to KSh 0 and status flipped to "Settled." The `*Minor`
rename recommended by the financial review is deliberately deferred
past handover — see `docs/handover-phase3a-financial-fixes.md`.

## BUG-12: Voiding a credit sale doesn't reduce the customer's balance owed
**Severity:** critical
**Discovered:** Phase 2 financial code review (docs/financial-code-review.md), 2026-08-13
**Status:** fixed

### Description
`sumCreditForCustomer` and `sumCreditAcrossAllCustomers`
(`sales/queries.ts:80-96`) sum `PaymentLine` rows with `method: "credit"`
for a customer with no exclusion for voided sales. `markSaleVoided`
(`sales/queries.ts:11-21`) only updates the `Sale` row (`voided`,
`voidedAt`, `voidedBy`); it never touches the sale's `PaymentLine` rows.
So a voided credit sale's payment line keeps counting toward what the
customer owes forever — `getCustomerBalance`
(`sales/logic.ts:236-242`), `getCustomerBalanceForOwner`, and
`getTotalCustomerBalance` (the Dashboard's "Owed to you" figure) are all
affected, since all three derive from `sumCreditForCustomer` /
`sumCreditAcrossAllCustomers`.

The same file shows the correct pattern two functions away:
`sumCreditSaleQuantityByProductAtLocation` and
`sumSalesRevenueMinorAtLocationInPeriod` both filter `voided: false` by
querying `Sale` directly. The two credit-balance functions instead query
`PaymentLine`, which has no `voided` field of its own and isn't joined
back to `Sale.voided`. A comment at `sales/queries.ts:100-101` (on the
adjacent `sumRepaymentsForCustomer`) claims this exclusion is
"symmetric to how credit sums exclude void sales" — that claim is false
for `sumCreditForCustomer`.

### Repro steps
1. Record a credit sale for a customer (e.g. KSh 2,000).
2. Void that sale the same day (same staff member, before handover).
3. Open People → Customers → that customer, or the Dashboard's "Owed to
   you" tile.

### Expected vs actual
Expected: the voided sale's KSh 2,000 no longer counts toward the
customer's balance or the business-wide "owed to you" total.
Actual: the balance still shows KSh 2,000 owed — voiding stock and
un-voiding the `Sale` row does nothing to the `PaymentLine` the balance
is computed from.

### Notes
Fix: filter `sumCreditForCustomer` and `sumCreditAcrossAllCustomers`
through the `sale` relation (`where: { customerId, method: "credit",
sale: { voided: false } }`), matching the pattern already used by
`sumCreditSaleQuantityByProductAtLocation` in the same file. Contained,
no schema change — `PaymentLine` already has a `sale` relation to filter
through. See `docs/financial-code-review.md` Finding 2 for full tracing.

### Fix (2026-08-13)
Applied exactly the fix described above to both `sumCreditForCustomer`
and `sumCreditAcrossAllCustomers` (`sales/queries.ts`). Checked both
callers (`getCustomerBalance`, `getTotalCustomerBalance`) — neither
relied on the old (buggy) inclusive behaviour. Regression test:
`sales/tests/sales.integration.test.ts` — records a credit sale, asserts
the balance rises, voids it, asserts both the per-customer balance and
`getTotalCustomerBalance` return to zero.

## BUG-13: Staff-shell Stock page (StockList) never shows ingredients, no Products/Ingredients toggle
**Severity:** high
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** open

### Description
`src/modules/stock/ui/stock-list.tsx` — the Stock page every non-owner
role lands on via `/staff` (`staff-page-client.tsx:93`) — only ever
fetches and renders **products**. Its two fetch paths, `fetchStock`
(`GET /api/stock/:locationId`) and `fetchStockBySource`
(`GET /api/stock/:locationId/by-source`, canteen only), both return
`StockLevel`/`StockLevelWithSource` shapes keyed by `productId`/
`productName`. Ingredients are a genuinely separate model
(`docs/architecture.md`'s ingredient-vs-product split) with their own
data and their own endpoint (`/api/stock/:locationId/ingredient-value`),
but `StockList` never calls it — ingredients cannot appear on this
screen under any filter, for any role.

A Products/Ingredients toggle already exists, but only on the
**owner-only** `AdminStockTable` (`/stock`, gated to `role === "owner"`
in `src/app/stock/page.tsx`), added in the most recent commit
(`d7a9b73`). It was never extended to the staff-facing `StockList` that
the store manager and canteen attendant actually use day-to-day. The
only tab/filter logic `StockList` has is the canteen's "My stock / From
restaurant" source split (`isCanteen`), which is itself product-only.

Production output is correctly wired and unaffected by this bug —
`recordProduction` (`stock/logic.ts:1124`) deducts ingredients and
creates a real product-stock movement, so produced items (e.g. Chips)
do appear as product stock once the same screen is fixed to show
products correctly; only the ingredient side is missing.

### Repro steps
1. Log in as Store Manager.
2. Receive a delivery of an ingredient (e.g. Potatoes or Cooking oil).
3. Open the Stock page (staff shell, `/staff`).

### Expected vs actual
Expected: the store manager's Stock page shows both the ingredients on
hand (potatoes, cooking oil, etc. — what she just received) and the
products on hand (what the kitchen has produced), ideally with a
Products/Ingredients toggle mirroring the one already built for the
owner's `AdminStockTable`.
Actual: only products ever render; ingredients received are invisible
on this screen regardless of what was just recorded. No toggle exists
to switch views.

### Notes
Reported by the client mid-walkthrough as "the stock page isn't showing
what I received" — traced to a structural gap (wrong/missing data
source), not a query or filter bug. Fix should reuse
`ingredient-value`'s data (or a lighter ingredient-quantity endpoint,
since `StockList` doesn't need cost/value, only quantity-on-hand) and
extend `StockListView`'s existing tab pattern to add a Products/
Ingredients toggle, consistent with `AdminStockTable`'s. Not fixed
inline — logged per the walkthrough checklist's own rule, to keep
testing moving; route through `/fix` or `/add` when ready.

## BUG-14: New Sale offers products with no stock history at the requester's location
**Severity:** critical
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** fixed — 2026-08-13, ticket 53

### Description
Reported as "the items I see in New Sale don't match what's on the Stock
page" — e.g. Mukimo appears as sellable at the canteen on New Sale, but
never appears on the canteen Stock page (neither "My stock" nor "From
restaurant"), because the canteen has no stock history for it at all.

The Stock page is correct, not buggy: `getCurrentStockAtLocation`
(`src/modules/stock/logic.ts:154`) sums real `StockMovement` rows for
that specific location via `sumMovementsByProductAtLocation`
(`src/modules/stock/queries.ts:51-65`) — a product with zero movements
at a location correctly shows nothing there.

New Sale is the actual bug: `activeProductsRoute`
(`src/modules/catalogue/routes.ts:62-67`) does
`listProducts(db).filter(p => p.active)` — every active catalogue
product, for every location, with no location scoping and no join
against `StockMovement` at all. `Product`/`Ingredient` have no
`locationId` or location relation in the schema (unlike `Asset`, which
does) — location-ness was designed to live implicitly in the movement
ledger, not on the catalogue item. New Sale never consults that ledger,
so the implicit design is never actually enforced on the one screen
that most needs it.

Practical effect: a canteen attendant can "sell" a product the canteen
has never received/produced/transferred a single unit of. The seed data
itself does this — `prisma/seed.ts:343` and `:356` record canteen sales
of Mukimo, whose only `StockMovement` rows are at the restaurant
(`prisma/seed.ts:263-264`). Nothing in `recordCounterSale` appears to
check location stock before accepting the sale either (not yet
confirmed directly — worth checking during the fix).

### Repro steps
1. Log in as canteen attendant.
2. Open New Sale — note Mukimo (or any restaurant-only-stocked product)
   appears as sellable.
3. Open the Stock page (both tabs) — Mukimo appears in neither.
4. (Optional) Complete a sale of Mukimo at the canteen — it succeeds
   despite zero canteen stock ever existing.

### Expected vs actual
Expected: New Sale only offers products/ingredients with real stock
history at the requester's own location, consistent with the Stock
page and with `getTransferableItems`' existing pattern
(`stock/logic.ts:360-385`) of scoping to positive movement sums at a
location.
Actual: New Sale shows the full global catalogue regardless of
location, allowing sales with no stock backing.

### Notes
Two possible fix shapes, deliberately not decided yet:
1. **Stock-aware New Sale** (smaller, no schema change) — scope the
   active-products/ingredients list to items with movement history at
   the requester's location, mirroring `getTransferableItems`.
2. **Explicit location assignment** (bigger, schema-level) — give
   Product/Ingredient real location scoping (e.g. a locations relation)
   independent of stock history, so a location can be restricted to
   sell certain products even before any stock movement exists.

Edwinfred wants this logged and investigation of other stock-page
issues to continue before deciding which shape to take. Route through
`/fix` or `/add` when ready to decide/build.

### Fix (2026-08-13, ticket 53)
Shape 2 (explicit location assignment) chosen — see
`docs/scope.md`'s 2026-08-13 "Product home location, and an overselling
guard" entry and `docs/architecture.md`'s "Product home location" note
for the full reasoning. `Product` gained a required `locationId`, set at
creation and editable after. A new `getSellableProductsAtLocation`
(`stock/logic.ts`) unions `product.locationId === here` with positive
current stock at `here` per the movement ledger, mirroring
`getTransferableItems`'s shape. `activeProductsRoute` (now
`sellableProductsAtLocationRoute`, moved to `stock/routes.ts` — see that
file's comment for why; the URL stays `/api/catalogue/products/active`)
requires a `locationId` query param and calls this function instead of
returning the full catalogue.

`new-sale.tsx`, `credit-sale.tsx`, `receive-delivery.tsx`, and
`record-wastage.tsx` all pass the requester's own `locationId`. New Sale
and Credit Sale visually group tiles into "My stock" / "From another
location" sections, the latter badged "Transferred in". The staff Stock
page (`stock-list.tsx`) gained the same split (`StockLevel.isOwn`),
addressing the client's original "the items I see in New Sale don't
match what's on the Stock page" report from both sides at once.

Seed data's 12 products (13 named in the ticket's context section
described a different, unmerged branch's seed state — not `main`'s;
noted rather than silently reconciled) each carry a real `locationId`
matching their seeded movement history. Regression: 4 new integration
tests in `stock/tests/sellable-products.integration.test.ts` — own
product with no movements (included), transferred-in-and-reflected
product (included), product with neither (excluded — the literal repro
above), and a product excluded at a *different* location than its home
despite having stock there under a different rule (home-location match
alone is sufficient regardless of stock).

## BUG-15: Nothing prevents overselling — no on-hand visibility on New Sale, no backend check
**Severity:** critical
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** open

### Description
Two compounding gaps on the sale-recording path, found together but
distinct from BUG-14 (which is about a product appearing at a location
it has *no* stock history at all — this bug is about a product that
does belong at the location, but selling more of it than is on hand).

**1. No UX signal.** `src/modules/sales/ui/new-sale.tsx` fetches only
`/api/catalogue/products/active` (line 83), which returns
`{ id, name, kind, priceMinor, active }` — no stock quantity field at
all. Product tiles (lines 498-524) render only name and price; basket
quantity steppers (`bump`, line 337) have no upper bound tied to stock.
A cashier/attendant has no way to see how many units of an item remain
without leaving New Sale and checking the Stock page separately.

**2. No backend guard either.** `recordCounterSale`
(`src/modules/sales/logic.ts:165-205`) delegates to `priceAndCreateSale`
(`logic.ts:61-160`), which validates quantities are positive and prices
lines, then writes the sale and calls `recordStockMovement` per line
(`logic.ts:150-157`) — at no point does it read current stock-on-hand
or compare it to the requested quantity. No `insufficient_stock` reason
exists anywhere in the sales module (only in `stock/logic.ts`). A sale
for more than is on hand succeeds silently and drives stock negative.
Sale-line writes also aren't wrapped in a transaction with the sale
record.

Contrast: `recordTransfer` (`src/modules/stock/logic.ts:417+`) already
has the correct pattern — inside a `db.$transaction`, it sums existing
movements at the source location and returns
`{ ok: false, reason: "insufficient_stock" }` before writing anything if
the sum is short. Sales never got the equivalent treatment.

### Repro steps
1. As any sales-capable role, open New Sale.
2. Note no tile shows remaining stock for any product.
3. Select a product known to have low/zero stock at this location, set
   quantity higher than what's on hand, submit.
4. Sale succeeds; check Stock page or Product Ledger — quantity is now
   negative or understated with no rejection ever surfaced.

### Expected vs actual
Expected: staff can see roughly how much of an item is available while
selling (mirroring the low-stock badge pattern already built in
`admin-stock-table.tsx` — `isLow` + `TriangleAlert`, warning tone), and
the backend rejects a sale line that exceeds on-hand stock as a hard
guarantee, the same way `recordTransfer` already does.
Actual: neither exists. Overselling is possible from the UI with no
warning, and even a careful UI could be bypassed by a stale tile, a
race between two staff, or a direct API call, since there is no
server-side check at all.

### Notes
Two guardrails, not one — both wanted, not either/or:
- **Soft (UX):** show on-hand quantity per tile in New Sale, reusing
  the existing low-stock visual pattern. Needs a stock-levels fetch
  wired into `new-sale.tsx`, which currently has none.
- **Hard (data integrity):** add an on-hand check to
  `recordCounterSale`/`priceAndCreateSale` before committing stock
  movements, mirroring `recordTransfer`'s `insufficient_stock` guard,
  and wrap the sale + stock movements in a transaction together.

Likely shares plumbing with BUG-14's fix (both need New Sale to become
stock-aware for the requester's location) — worth deciding together
whether one ticket covers both or they're sequenced. Not fixed inline;
route through `/fix` or `/add` when ready.

## BUG-16: Canteen attendant's "Sales today" tile always showed KSh 0
**Severity:** high
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** fixed

### Description
On the attendant's "Today's summary" screen, the "Sales today" stat tile
stayed at KSh 0 even after recording several sales, while those same
sales appeared correctly, with the right totals, in the list below.

### Repro steps
1. Log in as Canteen Attendant.
2. Record a walk-in cash/M-Pesa sale (e.g. 2x Biscuits, KSh 100).
3. Return to Today's summary.
4. "Sales today" reads KSh 0; the sale itself is listed below with the
   correct amount.

### Expected vs actual
Expected: "Sales today" reflects the total of today's non-voided
cash/M-Pesa sales.
Actual: always 0 for the canteen attendant specifically.

### Root cause and fix
`soldTotalMinor()` in `src/modules/sales/ui/todays-sales.tsx` summed
each sale's `paymentLines` filtered to `cash`/`mpesa`. Per the
2026-08-13 canteen redesign (`docs/proposal.md` §4), a canteen
cash/M-Pesa sale is recorded with **zero** payment lines at entry —
reconciled later against the day's combined handover total instead of
per sale (see `logic.ts`'s `priceAndCreateSale`). So the tile's sum was
always 0 for every canteen sale, even though `Sale.totalMinor` was
correctly persisted and shown in the list. The restaurant/cashier till
was unaffected, since those sales always carry payment lines. The
summary tile's stat logic was never updated when the sales list's query
was, during the redesign.

Fixed by falling back to `sale.totalMinor` when a sale has no payment
lines at all; credit sales are unaffected since they always carry one
`credit` payment line, already excluded by the existing method filter.

Initially misread as sales being conflated with transfers (a "See
transfers" link sits directly under the tiles) — confirmed via code
trace that `Sale` and `Transfer` are separate models and the list below
queries `Sale` correctly; the link is just adjacent UI, not related.

## BUG-17: Credit sale is a separate screen, not folded into New Sale
**Severity:** normal
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** open

### Description
`docs/qa-handoff-checklist.md` (step 2) expects a credit sale to use
"the same entry flow" as an ordinary sale — "one flow, not a separate
screen." In the running app, `CreditSale`
(`src/modules/sales/ui/credit-sale.tsx`) is instead a distinct nav
destination from `New Sale` (wired separately in
`src/app/staff/staff-page-client.tsx`), with its own product picker,
basket, and submit path duplicated from `new-sale.tsx` (the file's own
header comment calls this deliberate — "trimmed from new-sale.tsx's
Till, not a reuse of it (ticket 26)").

The file's header comment also describes the pre-2026-08-13-redesign
model ("individual sales aren't recorded at the point of sale at the
canteen — only credit sales are"), which is stale: per the current
`recordCounterSale`/`priceAndCreateSale` logic, the canteen now records
every sale individually, cash/M-Pesa included, via the same path as the
restaurant till; credit is just one payment-line option within that
flow, not the sole recording mechanism.

### Expected vs actual
Expected (per proposal.md §4 and the QA checklist): recording a credit
sale is the same New Sale flow, with a customer named inline, not a
separate screen.
Actual: a whole separate `CreditSale` component/nav entry exists,
duplicating New Sale's picker and basket rather than being an option
within it.

### Notes
Found while fixing the "My stock / From restaurant" tabs UX (this
session) — `credit-sale.tsx` had the identical stacked-section picker
as `new-sale.tsx`'s, both now converted to tabs for consistency, but
that's a surface fix; the deeper duplication (and the screen split
itself) is unresolved. Not fixed inline — likely a `/fix` or `/add`
scoping question: fold credit into New Sale's existing payment-method
step, or confirm the checklist's wording is the part that's stale
instead. Worth deciding before ticket 26's separate-screen decision is
revisited any further.

## BUG-18: Admin Dashboard's Handover section excluded the canteen entirely
**Severity:** high
**Discovered:** manual testing (Edwinfred), full-day walkthrough, 2026-08-13
**Status:** fixed

### Description
Handovers recorded by Store Manager, Restaurant Cashier, and Canteen
Attendant did not appear on the Admin Owner's Dashboard — the Handover
section stayed empty or incomplete despite handovers being recorded
today.

### Repro steps
1. Record a handover as Store Manager (restaurant) and/or Restaurant
   Cashier.
2. Record a handover as Canteen Attendant.
3. Log in as Admin Owner, view Dashboard's Handover section.
4. Canteen Attendant's handover never appears, regardless of what else
   was recorded.

### Root cause and fix
`todaysHandoversAtRestaurantRoute` (`src/modules/cash/routes.ts`) hard-
coded `findLocationByCode(db, "restaurant")` before fetching handovers —
a leftover from ticket 14, when this comment was accurate: "the canteen
has no handover concept yet, and this screen must not imply canteen
coverage that doesn't exist." The 2026-08-13 canteen redesign
(`docs/proposal.md` §5) gave the canteen a real handover, checked as a
single combined cash+M-Pesa figure rather than the restaurant's
cash/M-Pesa split (a canteen sale carries no payment method at entry, so
the split isn't knowable — see `Handover.expectedMpesaMinor`'s schema
comment, `null` there means "combined total, see expectedCashMinor," not
"expected zero"). The write path (`recordHandover`) was updated for
this; the dashboard's read path never was, so canteen `Handover` rows
were written correctly but never queried.

Fixed:
- `findTodaysHandoversAtLocation` → `findTodaysHandoversAtLocations`
  (`queries.ts`), taking a list of location ids instead of one.
- `getTodaysHandoversAtLocation` → `getTodaysHandovers` (`logic.ts`),
  fetching all locations via `listLocations` rather than being handed
  one.
- Route renamed `todaysHandoversAtRestaurantRoute` →
  `todaysHandoversRoute`, endpoint moved `/api/handovers/today-at-
  restaurant` → `/api/handovers/today-all`.
- `dashboard-handovers.tsx` now renders two tables instead of one —
  restaurant rows (4-column cash/M-Pesa split, unchanged) and canteen
  rows (3-column combined check: Sales recorded / Cash + M-Pesa in /
  Difference, matching proposal.md §5's own worked example) — driven by
  `expectedMpesaMinor === null` as the documented signal for a canteen
  row. The two checks aren't the same shape, so a single unified table
  would either misrender the canteen's combined figure or hide the
  restaurant's per-currency detail.

Per the QA checklist's step 9 ("today's restaurant handovers... and the
canteen's combined-figure handover... all show, correctly
distinguished") — the two-table split satisfies "distinguished" more
directly than one table with a location column would.

## BUG-19: Money out screen wrongly claimed stock purchases reduce profit
**Severity:** normal
**Discovered:** client questioning during review, 2026-08-17 — she asked
whether stock was being double-counted, which surfaced the false claim
**Status:** fixed — 2026-08-17

### Description
The Money out screen (now "Expenses") stated in three places that a
stock purchase reduces profit at the moment it is paid for. It does
not. Profit is `revenue − costOfGoods − runningCosts`
(`reporting/logic.ts:321`), and `runningCosts` sums `category:
"running"` only (`cash/queries.ts:174-190`). Stock reaches profit
through cost of goods sold, measured from stock movement (opening +
bought − closing, `docs/formulas.md` §6) — that is, when the stock
*sells*, not when it is bought.

The false claim appeared in:
- the stat bar's "Reduced profit" box, summing stock + running
  (`money-out-list.tsx:150-165`)
- the per-row "Reduces" column printing "profit and cash" for every
  stock row (`money-out-list.tsx:115-123`)
- the table footnote's closing sentence, and the empty state's "listed
  here with what it reduced" framing

All three were driven by one `reducesProfit` map marking `stock: true`
(`money-out-list.tsx:41-47`), which was the root of the error.

### Repro steps
1. Log in as owner, open Money out.
2. Record (or view) a stock purchase.
3. Compare the "Reduced profit" figure against the Dashboard's net
   profit for the same period.

### Expected vs actual
Expected: the screen agrees with the Dashboard about what reduces
profit — operating costs when paid, stock when sold, assets and
drawings never.
Actual: the screen counted stock purchases as an immediate reduction in
profit, contradicting the Dashboard and implying stock was being
double-counted.

### Impact
**No stored data was affected, and the Dashboard's profit figure was
correct throughout.** This was a display error only — the wrong figure
was computed in the browser for the stat bar, never persisted and never
fed into any profit calculation. No schema change, no migration, no
logic change was needed to fix it.

### Fix (2026-08-17)
Display-only. The `running` enum value in the database is unchanged.
- `reducesProfit` deleted, along with the per-row "Reduces" column it
  fed (table 7 → 6 columns, `minWidth` 880 → 760, `LoadingTable
  columns` 8 → 6).
- Stat bar's middle/right boxes replaced with per-category totals:
  Assets ("equipment the business owns") and Drawings ("owed back to
  the business"). Reversed entries stay excluded, per
  `docs/formulas.md`'s opening rule.
- Footnote and empty state rewritten to state the real behaviour.
- Page renamed "Money out" → "Expenses" (display only — the
  `/money-out` URL and route folder are unchanged, so saved links keep
  working).
- Category renamed "Running cost" → "Operating cost" across all six
  label maps (the four named in the ticket, plus
  `reporting/logic.ts`'s `EXPENSE_CATEGORY_LABEL` and
  `lib/fixtures.ts`'s `cashCategoryLabel`, both found by grep), the
  Dashboard's own four profit labels, and the spec docs.
- `proposal.md:271` carried the same false claim in prose and was
  corrected alongside the screen.
