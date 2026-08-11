# 34 — Asset register (Catalogue)

**Type:** logic (test-first)
**Blocked by:** None (extends `catalogue`, reads optionally from
`cash`'s existing `Expense` records — a one-directional read, same
shape as `stock → catalogue`'s existing precedent)
**Status:** done

## Goal

Give the owner a place to record the durable things the business owns
(equipment, furniture, plates, spoons, cups) — `docs/scope.md`'s newly
added "Asset register" feature area (REQ-01, `docs/feature-requests.md`).
Today, buying an asset only creates an `Expense` row (category `asset`,
ticket 16); there is no register of the assets themselves.

## Context

- `docs/scope.md`'s "Added post-v1 → Asset register" section is this
  ticket's full definition of done — read it before starting, don't
  re-derive scope from this ticket alone.
- Relevant module: `src/modules/catalogue/` — new tab alongside
  `products-tab.tsx`, `ingredients-tab.tsx`, `recipes-tab.tsx`. Structural
  precedent: `ingredients-tab.tsx` (simple owned-item list, add/edit
  form) is the closer shape than `recipes-tab.tsx` (versioned, more
  complex) — copy from ingredients' tab, not recipes'.
- **Important divergence from existing Catalogue precedent — do not
  copy this part.** `deactivateIngredient`/`deactivateProduct`
  (`catalogue/logic.ts` line 148 and nearby) are *visible* soft-deletes:
  the row stays in the list, dimmed, badged "Inactive," reactivatable
  (`ingredients-tab.tsx` lines 34, 53, 69–72). This ticket's retirement
  is explicitly different and was confirmed with Edwinfred after
  flagging the inconsistency: a retired asset must **not** appear in the
  owner's UI at all — filtered out of every list/read, not shown dimmed
  or badged. The database row is kept (never a hard `DELETE`), but the
  UI must behave as if it's gone. Do not reuse `active`/dimmed-badge
  styling for this — it would show exactly what was asked not to be
  shown.
- `src/modules/cash/index.ts`'s `Expense` export (ticket 16) — the
  optional link target. Read-only reference from `catalogue` to `cash`,
  matching the existing one-directional cross-module-read precedent
  (`stock → catalogue`, `stock → sales`) rather than inventing a new
  seam shape.
- `docs/architecture.md`'s Modules table and its "Why `cash` is separate
  from `sales`" reasoning — this ticket doesn't change that boundary,
  it only adds a new optional read from `catalogue` into `cash`.

## Scope

**In:**
- A new `Asset` model: name, `locationId`, quantity, optional
  `expenseId` (nullable FK to `Expense`), a boolean or nullable
  `retiredAt`-style field used only to filter list reads — never
  surfaced as a visible "Inactive" state in the UI.
- One register row per asset type per location — a second purchase of
  the same-named asset at the same location increases the existing
  row's quantity rather than creating a duplicate row (per
  `docs/scope.md`'s "accumulates" rule). Match on name + location;
  confirm the exact matching rule (case-sensitivity, whitespace) against
  how `catalogue`'s existing product/ingredient name uniqueness is
  handled, for consistency.
- `createAsset`, `updateAssetQuantity` (or equivalent for recording a
  new purchase against an existing row), `linkAssetExpense` (optional,
  can be set at creation or added later), `retireAsset` (soft-delete —
  sets the filter flag, does not delete the row).
- `listAssets` excludes retired assets by default — no UI path to see
  them again in this ticket (no "show retired" toggle asked for; don't
  add one speculatively).
- New Catalogue tab (`assets-tab.tsx` or similar), reusing
  `ingredients-tab.tsx`'s list/add/edit form shape, with a "Retire"
  action instead of an active/inactive toggle.
- Owner-only for every write (add, edit quantity, link expense, retire)
  — same access pattern as the rest of Catalogue.

**Out:**
- Depreciation or any cost-over-time spreading — explicitly excluded by
  `docs/scope.md`'s original v1 exclusion, restated in the new section.
- Individual serialization ("Freezer #1" vs "#2") — always a quantity,
  never individually tracked, per the confirmed scope.
- Any change to `Expense`/`recordExpense` (ticket 16) — this ticket only
  adds an optional read/link, no changes to how a payment itself is
  recorded.
- Un-retiring an asset — not asked for; if retirement turns out to need
  reversal later, that's a follow-on request, not assumed here.
- Wiring assets into any profit/valuation calculation — `docs/scope.md`
  is explicit assets stay out of profit; no reporting-stage work here.

## Acceptance criteria

- [ ] An asset can be created with a name, location, and quantity;
      optionally linked to an existing `Expense` (category `asset`).
- [ ] A second purchase of the same-named asset at the same location
      accumulates into the existing row's quantity rather than creating
      a duplicate.
- [ ] `listAssets` never returns a retired asset — verified by creating,
      retiring, and confirming it's absent from the list result, not
      merely flagged.
- [ ] The underlying database row still exists after retirement (no hard
      delete) — verified directly, not just inferred from the list
      behavior.
- [ ] Only the owner can create, update quantity, link an expense, or
      retire an asset; other roles are denied at the route.
- [ ] **Screen:** a new Catalogue tab lists assets (name, location,
      quantity, linked expense if any), with an add/edit form and a
      "Retire" action. Retired assets do not appear anywhere in this
      screen after the action completes.
- [ ] Loading, empty (no assets recorded yet), and error states via
      `components/patterns/states.tsx`.
- [ ] Storybook story covering: empty state, list with several assets,
      add form, retire action.

## Verification

- Integration tests, test-first: create, quantity accumulation on repeat
  purchase, optional expense link, retirement excludes from `listAssets`
  while the row persists in the database, owner-only gate on every write.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new story to `docs/screens.md`'s Catalogue section.
