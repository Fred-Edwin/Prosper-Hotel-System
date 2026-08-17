# Help panel copy — Owner role (draft 2)

For approval. One write-up per nav destination (as it appears in the
sidebar), sectioned by tab where that page has tabs — so opening "?"
once on Catalogue, Ledger, or People shows all of that page's tabs in
one scroll, not one help panel per tab.

Nav order and exact labels confirmed against
`components/layout/admin-nav.ts`: **Dashboard, Ledger, Stock, Money out,
People, Catalogue, Activity.**

---

## Dashboard

**What this screen is for:** Today's figures, at a glance, and anything
that needs your attention.

**Profit** (top of the page)
- Switch between **Day / Week / Month**.
- Four figures, in order: **Revenue** (everything taken in) minus
  **Cost of goods sold** (what it cost you to sell it) minus
  **Operating costs** (electricity, gas, rent — not equipment, not your
  own drawings) equals **Net profit**.
- Tap any figure to see how it's built up.
- Marked **"partly provisional"**: the canteen doesn't record every sale
  individually, so its cost of goods is partly an estimate based on your
  last stock count there. It corrects itself automatically once you
  count again — you'll see a note showing the correction when that
  happens.
- Below that, the same figures broken down **by location** — Restaurant
  and Canteen side by side.

**Four quick figures**
- **Cash position** and **M-Pesa balance** — what you're actually
  holding, after everything handed over, minus everything paid out.
- **Owed to you** — total unpaid credit across all customers.
- **Your drawings** — money you've personally taken out, minus what
  you've paid back.

**Revenue and profit chart**
- Last 14 days, revenue and net profit side by side, one bar per day.
- A day with no bar means the business didn't trade that day, not that
  it made nothing.

**Needs you**
- A short list of anything that doesn't look right today: a staff
  member who handed over less than expected, or a sale that was voided.
- Nothing listed means everything agreed today.
- Tap an item to go straight to the record behind it.

**Handovers** (Restaurant only — the canteen doesn't hand over the same
way)
- Who handed over today, what they owed you, and what they actually
  gave you.
- **Agreed** means it matched exactly. Anything else is shown in red as
  the difference.

**Stock movements**
- Everything that moved today — received, sold, transferred, wasted,
  and so on — grouped by reason and location.
- Wasted, consumed, and given-away rows are shown in red, since that's
  value lost rather than sold.

**Restaurant store**
- Today's ingredient flow at the restaurant: what came in, what went to
  the kitchen, what was sent to the canteen, and what's left.

---

## Ledger

**What this screen is for:** The full detailed history behind every
figure on the Dashboard — sale by sale, shilling by shilling. Four tabs:

**Product ledger**
- Every product sold, with its cost and profit.
- Search by name, filter by location or category.
- Tap a day to expand it into individual sales.

**Store ledger**
- Ingredients moving through the store, valued at what you paid for
  them.
- Search and filter by location. No day-by-day expansion here — this
  tab shows the running picture, not individual transactions.

**Non-sales ledger**
- Stock that left without being sold: wasted, used internally, or given
  away.
- Filter by reason, search by item or who recorded it.
- An "est" tag means the cost shown is an estimate, because no purchase
  price or recipe exists for that item.

**Cash ledger**
- Every cash and M-Pesa movement, with a running balance for each,
  tracked separately.
- Filter by category, search by note. Tap a day to expand it into
  individual transactions.

---

## Stock

**What this screen is for:** How much of everything you have right now.

- Switch between **Restaurant** and **Canteen** if both have stock.
- Shows current quantity and current value of everything on hand.
- **Low stock** filter shows what's running out.
- **Record a count**: compare what's on the shelf to what the records
  say. A mismatch is shown as a difference, not corrected automatically
  — you decide separately whether to correct it.

---

## Money out

**What this screen is for:** Every payment you make out of the
business — you're the only one who records this, which is what makes
your cash balance trustworthy.

- **Record an expense**: choose a category — stock, operating cost
  (electricity, gas, rent), an asset (equipment/furniture), or a
  personal drawing.
- Asset purchases and personal drawings don't count against profit —
  they still cost cash, just not business expense.
- A drawing is tracked as a debt you owe back to the business.
- Made a mistake? **Reverse** the entry — it stays on record, just
  marked cancelled and excluded from your totals.

---

## People

**What this screen is for:** Everyone who works here, their pay, and
your customers. Three tabs:

**Staff**
- **Add** a staff member — set their name, PIN, role, and location.
- **Edit** their rate or role.
- **Deactivate** someone who's left. Their past sales stay on record;
  they just can't log in anymore.

**Days worked**
- **Record** a day worked for a staff member.
- See what's owed and mark it as paid.

**Customers**
- See who owes you money, and how much.
- **Add** a new customer for credit sales or deliveries.

---

## Catalogue

**What this screen is for:** Everything you sell, everything you buy to
cook with, and how they connect. Five tabs:

**Products**
- Everything you sell — food, drinks, goods, services.
- **Add** or **edit** a product's price and details.
- Turn a product **inactive** to stop it appearing at the till, without
  losing its sales history.

**Ingredients**
- Everything you buy to cook with, never sold directly.
- **Add** or **edit** an ingredient and its unit (kg, litre, etc.).

**Categories**
- Groups for your products and ingredients (e.g. "Drinks",
  "Stationery"), used as filters in your reports.
- **Add**, rename, or remove one.

**Recipes**
- How much of each ingredient goes into a cooked dish, and what that
  costs you.
- **Build a recipe**: pick ingredients and quantities.
- A dish can have more than one recipe version over time — older ones
  stay on record.
- Not every dish needs a recipe. Without one, you still see total
  profit — just not that dish's own margin.

**Assets**
- Equipment and furniture you own.
- **Record** one when you buy it. It doesn't count against profit —
  buying it just turns cash into something you still own.

---

## Activity

**What this screen is for:** A record of everything entered into the
system, including corrections to past records.

- **Filter** by type of entry or by who recorded it. Search covers
  reason text too.
- A **correction** is shown differently from a normal entry — it's a
  new entry that fixes a past figure, with a reason and your name
  attached. The original figure is never erased.
- **Record a correction** from here when a physical count disagrees
  with the record and you've decided to fix it. Only you can do this.

---

**Next:** once you approve or mark up edits, I'll draft Cashier
(New sale, Today's sales, Wastage, Stock, Handover), then Attendant,
then Store manager.
