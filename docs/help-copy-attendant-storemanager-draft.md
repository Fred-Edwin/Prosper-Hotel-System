# Help panel copy — Attendant & Store manager (draft 1)

For approval. Only screens not already covered under Cashier. Shared
screens reuse that exact copy, listed below for reference:
- **Today's sales**, **Wastage**, **Stock**, **Handover** — same as
  Cashier (see `help-copy-cashier-draft.md`). Handover's text applies to
  Store manager as-is; Attendant's Handover checks against Takings
  instead of individual sales — see note under Takings below.
- **New sale** — same as Cashier, used by Store manager only (Attendant
  does not have this link; uses Takings + Credit sale instead).

---

## Attendant-only screens

### Takings

**What this screen is for:** Recording today's total cash and M-Pesa
taken, at the end of the day.

- Enter **Cash** (notes and coins taken today) and **M-Pesa** (from your
  payment messages) as two totals — not item by item.
- Confirm, then **Record today's takings**.
- Already recorded today? You'll see what you entered. Made a mistake?
  **Record again** to correct it, any time later that day.
- This is what your **Handover** is checked against, so enter it before
  you hand over.

### Credit sale

**What this screen is for:** Recording a sale that a customer will pay
for later.

- Tap products to add them, same as a normal sale.
- A **customer is always required** here — pick an existing one or add a
  new one.
- **Record credit sale** once you've added items and picked a customer.
- This is the only way to record an individual sale at the canteen —
  everything else is covered by your daily Takings total instead.

---

## Shared: Attendant & Store manager

### Receiving

**What this screen is for:** Recording a delivery arriving from a
supplier.

- Switch between **Products** and **Ingredients** — one delivery can
  include both.
- For each item: enter **quantity** and the **price paid per unit**.
- This only records what arrived and what it cost — it doesn't record
  paying the supplier. That's handled separately.
- **Complete** once every item has a quantity and a cost.

### Stock count

**What this screen is for:** Counting what's physically on the shelf.

- Search and add each product or ingredient you're counting.
- Enter the **quantity you counted** — just the number, nothing else.
- Submit to see the count on record. Comparing it against what the
  system expected, and correcting any difference, is the owner's step —
  you won't see that part here.

### Transfer stock

**What this screen is for:** Sending stock to the other location.

- Search what you have on hand, tap to add it, set the quantity (capped
  at what's available).
- Review, then **Transfer** — it moves immediately, there's no approval
  step on the other end.
- Sent the wrong thing? Find it in the transfer history and **Reverse**
  it — the stock moves back, and the original stays on record.

---

## Store manager-only screens

### To kitchen

**What this screen is for:** Issuing ingredients to the kitchen for
cooking.

- Search and add each ingredient, with **quantity** only — no cost
  involved, since nothing is being bought or lost here.
- **Complete** once every item has a quantity.

### Production

**What this screen is for:** Recording what the kitchen made.

- Pick the dish, enter the **quantity** made.
- Only dishes with a current recipe can be recorded this way — if one's
  missing, you'll be told to check with the owner.
- One dish per entry.

---

**Next:** once approved, all four role drafts (Owner, Cashier, Attendant,
Store manager) are complete and ready to move into `/add` → `/design` →
`/tickets` for the actual help-panel build.
