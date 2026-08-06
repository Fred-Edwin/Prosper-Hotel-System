# Design — Prosper Hotel

Intent, and the reason behind each decision. Reasons do not go stale even when
code moves.

Token values live in `src/app/globals.css` and nowhere else. Component props
live in the components. Neither is repeated here, because a document restating
code drifts from it.

Vocabulary is in `CONTEXT.md`. The checkable rules are in
`.claude/skills/reference/UI-RULES.md`, and everything here **overrides** them
where the two disagree.

---

## The philosophy

This system replaces spreadsheets that already work. The bar is not "modern" —
it is *at least as good as the sheet she reads today, and faster to enter*.
Two consequences run through every decision below.

**Density over comfort.** Lucy reads a whole trading period at once. A layout
that shows twelve rows where the spreadsheet showed forty is a downgrade, however
handsome. Enterprise sizing throughout: 13px body, tight rows, tabular figures.

**Every figure shows its arithmetic.** The client's recurring question is not
*what is the number* but *how did we get there*. A figure presented without its
composition is a figure she cannot check, and a system she cannot check is one
she will keep a parallel spreadsheet for. This is why the dashboard and the
ledger both lead with a waterfall rather than a row of totals.

---

## Two shells

**Staff shell** — phones, one-handed, mid-service. Till, takings, receiving,
transfers, counts, handover.

**Admin shell** — laptop first, responsive down to a phone. Dashboard, ledger,
stock, money out, people, catalogue, activity.

**Why two rather than one responsive shell.** A cashier taking a sale with
customers waiting is not doing a small version of Lucy's profit report — it is a
different job. The till is thumb-driven and speed-critical; the ledger is a
sixteen-column table. One adaptive shell would serve both badly.

**The shell follows the task, not the role.** Lucy uses the staff shell when she
works a position on site and the admin shell to review at home. Do not gate
shells by role.

---

## Navigation

**Destinations are expensive; views are cheap.** A destination is a nav link. A
view is a tab, drill-down or sheet inside one. Thirty views across seven
destinations is ordinary software; thirty destinations is unusable.

**Target 5–8 destinations per person.** Admin has seven. Cashiers have three,
because they sell and should barely notice navigation exists.

**Group by person, never by module.** Modules describe where code lives and no
user experiences them. What a person can judge is their own working day.

Consequences already applied, and the reason each is not its own destination:

| Merged into | Absorbed | Why |
|---|---|---|
| Dashboard | Profit report, cash position, handover check | The same question at different zoom levels. Separating them made her navigate between halves of one thought |
| Ledger | Item history, sales, non-sales, transfers, counts | Every "why is this number what it is" view belongs in one place she can trust |
| Stock | Low stock, stock valuation, correct stock | A filter is not a destination |
| Catalogue | Products, ingredients, recipes, assets, customers | Reference data behind one link, tabbed |
| People | Staff, days worked, pay | Days worked is a field on a person, not a page |

**Setting a price is a field on the product form, owner-gated — not a screen.**

---

## Colour

**One accent element per screen: the primary action.** Nothing else.

This was got wrong once and is worth recording. An early till used the accent for
the active mode, the active category, basket badges, card borders, an avatar and
a per-location rail — eleven accent elements. The effect was the reverse of the
intent: "Complete sale" scrolled off-screen while already-tapped cards shouted for
attention. **Selection states use neutral fills**, which read as *chosen* without
competing with *do this next*.

**Semantic colours mean what they say.** Red is a shortfall or a destructive
action, green is agreement, amber is a warning. Never decorative. In a system
about money, a discrepancy must read as a discrepancy at a glance.

**No colour-coding of locations.** A per-location accent rail was built and
removed: it solved a problem not known to exist — staff only ever see one
location — and spent the accent budget doing it. If mis-located entries turn out
to be real, a location chip in the header is the honest fix, because it can be
read rather than learned.

---

## Figures and their arithmetic

**A figure and its composition sit together.** Not the figure in a stat row and
the breakdown elsewhere on the page. This was the specific failing of an early
dashboard: seven equal tiles with no hierarchy among them and the arithmetic in a
separate card below.

**A sequence of related figures is one instrument, not several widgets.** Where
figures form an arithmetic — revenue − cost of goods − running costs = net
profit — they are drawn as a continuous band: hairline dividers rather than
borders, proportion bars flush to the cell edges so they form one ribbon,
selection lifting to a raised surface with a rule in the term's own colour, and
explicit operators between cells. Four bordered boxes with a grey hover fill read
as four separate things that happen to be adjacent.

**Cost of goods sold and running costs carry weight.** They are the two terms
Lucy can act on — revenue is the market's answer, but what she pays for stock and
burns on gas are hers to change. They are headline figures, not lines inside
profit.

**Every figure links out to the record that explains it.** The dashboard states;
the ledger evidences. That link is the relationship between the two pages.

**Provisional figures are marked wherever they appear**, and the reason is stated
once rather than badged five times. The canteen's own-goods cost is estimated
between counts; nothing derived from it may present as exact. See
`docs/formulas.md`.

**A cost that is unknown renders as "—", never as zero.** Cooked food without a
recipe has no per-unit cost, so its profit cannot be stated. Showing zero would
assert something false.

---

## Ledgers and tables

**"Ledger" is the record; "table" is the component showing it.** Each of the four
— product, store, non-sales, cash — is a sub-ledger in the accounting sense, and
the stats bar is the summary they roll up into. Use the accounting word: it is
what the client's accountant would use, and it says *complete record* in a way
"movements" does not.

**One row per subject, movement types as columns.** Opening on the left, closing
on the right, so reading a row left to right is doing the calculation. All four
ledgers share this shape deliberately — an early cash ledger listed one row per
transaction and read as a different kind of record entirely, and could not answer
"what did I spend on stock this week" without arithmetic.

**Column groups get header spans.** Sixteen columns are navigable when the eye
finds a region before it finds a column; without grouping they are merely present.

**A period aggregates to one row per subject, not thirty.** These columns sum
honestly, so a month reduces to one row and the chevron expands it to its days.
Six rows when scanning, thirty when investigating.

**Child rows are visually distinct but recessive** — a spine anchored under the
parent's chevron, smaller muted type, and a closing edge beneath the last child.
Without the closing edge an expanded block in the middle of a long table bleeds
into the next parent and the hierarchy is lost.

**Product rows split by location.** Chips exist at both; a combined row would hide
which location holds the stock, which is the first thing a count needs to know.

**Every ledger is searchable and filterable, and the first column is frozen** so
horizontal scrolling never costs the subject's identity.

---

## Charts

**Charts answer what a figure cannot.** A single value plus its trend is a **stat
tile with a sparkline**, not a chart. Reach for a chart only when the question is
genuinely about shape over time.

**One axis, always.** Two y-scales invent a correlation that is not in the data.
Where two measures do not share a scale, they do not share a chart.

**No pie charts on the dashboard or ledger** — a decision about *this* data, not
a general rule. Lucy's questions are about level (how much did we make, how much
should I hold), and the waterfall already carries the one proportion that matters.
A pie of two slices is a rectangle bent into a circle, and a pie cannot mark an
estimated segment as estimated. Where a future screen genuinely asks a
part-to-whole question with comparable segments, a pie may be right.

**Emphasis over categorical** where one series is the point: the context series
recessive, the subject in the accent.

**Closed days are gaps, not zeroes.** Sundays break the line rather than drawing
to the floor. A zero on a closed day is a lie about trading.

Chart construction follows the `dataviz` skill — load it before writing any chart
code. The palette is validated with its script rather than by eye.

---

## Forms and entry

**The till is the speed-critical screen and stays uncluttered.** Anything added
to it costs money in dropped speed. The customer field appears only when the mode
or a credit payment line actually requires a named customer — never in the
counter flow.

**Payment is a list of lines, not a single value.** A sale settled partly in cash
and partly by M-Pesa is two lines, and splitting is typing in the second box
rather than clicking a "split" step to reveal it. Two lines are present from the
start for that reason.

**Fulfilment and payment are independent.** Counter/delivery is one question and
cash/M-Pesa/credit is another; a mode switch that fuses them cannot express "a
delivery paid in cash", which is common.

**Large tap targets on the staff shell.** A product grid, not a list — a list is
denser but far more error-prone under a thumb, mid-service.

---

## Mobile

**Portrait is the default; landscape is offered, never forced.** On narrow
screens a prompt offers a full-width expanded table. She may be holding the phone
one-handed for a reason, so rotation is her choice.

**The admin shell degrades rather than becoming a third shell.** Summary figures
become cards; tables scroll horizontally with the first column frozen. A
sixteen-column ledger cannot become mobile-friendly — it can only become
something else, and that something else would be a third shell answering
different questions.

---

## The rule that keeps this true

**New UI composes existing components and page templates. It never invents a
pattern.**

When a ticket needs a pattern that does not exist yet, **stop and ask** rather
than inventing one. A single invented pattern is invisible; twenty of them are
the reason enterprise software looks the way it does. This rule is the whole
point of the layers above it — primitives from shadcn, templates for layout,
tokens so arbitrary values are impossible by construction rather than by
discipline.
