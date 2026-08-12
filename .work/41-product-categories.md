# 41 — Product categories

**Type:** plumbing (test-after)
**Blocked by:** None (extends `catalogue`'s existing Product CRUD from
ticket 01)
**Status:** in-progress (claimed by Claude Code session, 2026-08-12)

## Goal

Give `catalogue` a real category concept for products, owner-managed, so
reporting (ticket 39's Product ledger, and any later screen) can filter
by category instead of substituting `ProductKind` for it. Split out of
ticket 39 during `/build`, 2026-08-12 — that ticket's design precedent
(`~/prosper-hotel-design-reference/src/components/design/ledger/
tables.tsx`) assumed a `category` field (food/drinks/snacks/stationery/
household/services) that has no equivalent anywhere in this codebase;
only `ProductKind` (goods/cooked_food/service/packaging) exists, and
that's a fixed enum the owner can't edit, not a category.

## Context

- `docs/architecture.md`'s `catalogue` module: owns products, ingredients,
  recipes, prices — a category is reference data of the same shape,
  belongs here.
- Ticket 01's Product CRUD (`src/modules/catalogue/logic.ts`,
  `createProduct`/`updateProduct`) is the direct precedent for another
  small owner-managed reference-data concept and its lifecycle rules
  (deactivate not delete, edit in place).
- `prisma/schema.prisma`'s `Product` model — needs a nullable
  `categoryId` relation to a new `Category` model (nullable: existing
  products and new ones the owner hasn't categorised yet must remain
  valid, not force a category on every product).
- No screens exist yet for managing categories — this ticket needs its
  own small settings-style UI (create/rename/deactivate a category) per
  `CLAUDE.md`'s "if a needed pattern doesn't exist, STOP and ask" — check
  `docs/screens.md` for anywhere close (e.g. how ingredients/products are
  managed) and match that shape; if nothing close exists, follow the
  `/build` skill's checkpoint for a new screen with no Design precedent.

## Scope

**In:**
- `Category` as a new reference-data type in `catalogue`: name, active
  flag. Owner creates, renames, deactivates/reactivates — same lifecycle
  pattern as Ingredient (ticket 01): deactivate, never delete, since a
  product may already reference it.
- `Product.categoryId` — nullable, one category per product, owner sets
  it on create/edit (extends ticket 01's `updateProduct`/`createProduct`,
  does not replace them).
- A way for the owner to manage categories (create/rename/deactivate) —
  small settings-style screen or panel; a product edit form field to
  assign a product's category, reusing the existing product form.
- `catalogue`'s `index.ts` exports whatever ticket 39 needs to read
  categories and filter/join products by category.

**Out:**
- Multi-category-per-product, category hierarchies/nesting — one flat
  category per product, matching the reference's flat category list.
- Re-deriving ticket 39's category filter itself — that's ticket 39's
  job once this exists; this ticket only makes the concept real.
- Seeding specific category names (food/drinks/snacks/etc.) — the owner
  defines their own categories; seed data may add a few for
  demonstration but the set itself isn't fixed by this ticket.

## Acceptance criteria

- [ ] Owner can create a category with a name.
- [ ] Owner can rename a category in place.
- [ ] Owner can deactivate a category; deactivated categories no longer
      appear in the product-edit picker but existing product references
      remain readable (same as ingredient deactivation).
- [ ] Owner can assign/change a product's category from the product edit
      form; category is optional (a product can have none).
- [ ] Non-owner roles cannot create/edit/deactivate categories or see the
      management screen (route-level check, same gate as the rest of
      `catalogue`'s owner-only writes).
- [ ] Storybook stories: category management (list, create, rename,
      deactivate, empty-first-use), and the product form's category field
      (set, unset, deactivated-category-still-shown-on-existing-product).

## Verification

- Integration tests, test-after (plumbing/CRUD, mirrors ticket 01's
  ingredient tests): create/rename/deactivate a category, assign to a
  product, deactivated category excluded from active pickers but still
  readable on an already-assigned product.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new screen/story to `docs/screens.md`.
