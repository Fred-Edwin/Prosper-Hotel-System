# 02 — Recipes: ingredients to product, effective-dated versions, expected yield

**Type:** logic (test-first)
**Blocked by:** 01 (ingredients and products must exist to be recipe inputs/outputs)

## What this delivers

The owner can define a recipe for a cooked-food product: which ingredients
and quantities go in, and the expected yield they produce (CONTEXT.md:
"a stated quantity of input should produce a stated quantity of output").
A recipe gives that product a per-unit cost (derived from ingredient
last-known cost × recipe quantities, divided by yield) and an expectation
that a later stage (production recording, stage 3) can check actual output
against.

No UI in this ticket — the recipe screen lands together with the rest of
Catalogue's screens in ticket 03.

Recipes exist only where a yield is known and reliable (CONTEXT.md) — most
products will have none, and that absence must be visible, not hidden
(design.md: "a list of three recipes hides that twelve dishes are sold at
unknown cost... a list of fifteen with twelve blank states it"). A product
with no recipe shows its cost as "—", per ADR 0005: recipes are demoted
from a costing prerequisite to a source of per-unit cost and yield
variance only — they do not participate in cost of goods sold (that comes
from stock consumption, a later stage). This ticket must not build
anything that makes COGS depend on recipes existing.

**Recipes are effective-dated versions, never edited in place** (design.md,
"Records that must not move silently"). A recipe's per-unit cost feeds
every profit figure derived from it; editing it in place would silently
restate a past figure. A change is a new version starting from a date;
past movements (once `stock`'s production recording exists, a later
stage) keep the version they were costed with. This is why a recipe has
version history rather than an edit form — this is the core logic this
ticket tests first.

## Lifecycle

- **Create:** owner selects a cooked-food product, adds one or more
  ingredient lines each with a quantity, and states the expected yield
  (a quantity of the output product). This is version 1, effective from
  creation (or an owner-chosen effective date).
- **Read:** owner sees the current effective recipe for a product (its
  ingredient lines, yield, and derived per-unit cost) and its version
  history (prior versions with their effective date ranges). Where a
  cooked-food product has no recipe at all, it is listed among the
  product's peers with its cost shown as "—", not omitted.
- **Update:** a "change" to a recipe is never an edit to the existing
  version. It is a new version, with its own effective-from date, leaving
  every prior version intact and queryable by the date it was in force.
  Only the owner may create a new version.
- **Delete:** not allowed on any version — matches "records that must not
  move silently." Recipe retirement (a recipe no longer wanted going
  forward, with no replacement version) is out of scope for this ticket —
  see below.
- **Undo:** creating a new version by mistake is corrected by creating
  another new version reverting the values — the same mechanism as any
  other change, consistent with "nothing that moved... is deleted." There
  is no separate undo path.

## Acceptance criteria

- [ ] Owner can create a recipe (ingredient lines + quantities + expected
      yield) for a cooked-food product that has none.
- [ ] The recipe's per-unit cost is derived from ingredient last-known
      cost × quantities, divided by yield, and is readable alongside the
      product.
- [ ] Creating a new version of an existing recipe does not alter the
      previous version's stored values; the previous version remains
      readable with its own effective date.
- [ ] Querying "the recipe in force on date X" returns the version whose
      effective date range covers X, not necessarily the latest version.
- [ ] A cooked-food product with no recipe at all shows its per-unit cost
      as "—", never `0`.
- [ ] A non-owner role attempting to create or version a recipe receives a
      permission-denied result.
- [ ] A recipe can only reference active ingredients and an active
      cooked-food product (attempting otherwise is a validation failure,
      not a silent success).

## Out of scope

- Any UI — the recipe screen is built together with the rest of Catalogue
  in ticket 03.
- Production recording / checking actual output against expected yield
  (stage 3 — this ticket establishes the expectation only, not the check).
- Cost of goods sold depending on recipes in any way (ADR 0005 explicitly
  rejects this).
- Recipe retirement (marking a recipe as no longer applicable going
  forward with no replacement version) — not asked for by the roadmap or
  proposal.md; if raised, treat as a gap to surface, not to invent.
