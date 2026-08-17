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
she will keep a parallel spreadsheet for.

---

## Two shells

**Staff shell** — phones, one-handed, mid-service. Till, takings, receiving,
transfers, counts, wastage, handover.

**Admin shell** — laptop first, responsive down to a phone. Dashboard, ledger,
stock, money out, people, catalogue, activity.

**Why two rather than one responsive shell.** A cashier taking a sale with
customers waiting is not doing a small version of Lucy's profit report — it is a
different job. The till is thumb-driven and speed-critical; the ledger is a
sixteen-column table. One adaptive shell would serve both badly.

**The shell follows the task, not the role.** Lucy uses the staff shell when she
works a position on site and the admin shell to review at home. Do not gate
shells by role.

**The two shells navigate differently, on purpose.** Admin has seven
destinations across three groups plus a location scope; staff have three to six
flat tasks. Admin gets a rail — a drawer on mobile, never a different navigation.
Staff get a launcher. Neither is a style preference; they have genuinely
different amounts to navigate.

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
| Dashboard | Profit report, cash position, handover check | The same question at different zoom levels |
| Ledger | Item history, sales, non-sales, transfers, counts | Every "why is this number what it is" view belongs in one place |
| Stock | Low stock, stock valuation, correct stock | A filter is not a destination |
| Catalogue | Products, ingredients, recipes, assets | Reference data behind one link, tabbed |
| People | Staff, days worked, pay, **customers** | Who the business owes, and who owes it |

**Customers live in People, not Catalogue.** A customer is not reference data —
it is a live balance that moves with every credit sale and repayment. Catalogue
is the one destination meant to be static; putting the fastest-moving record in
it was wrong. It also makes "taking a repayment happens on the customer" work,
because People is somewhere she would naturally go.

**Setting a price is a field on the product form, owner-gated — not a screen.**

**The nav is grouped: Today · Records · Setup.** Seven flat items is a list;
three groups is a structure that says what *kind* of thing each destination is
before the label is read.

**The location scope lives in the rail, not on a page.** Location is the cutting
dimension — it decides what stock exists and which day an entry belongs to — so
it applies to every destination. Global controls belong in global chrome.

**A count in the nav means something is waiting on you.** Never a volume. A
number that is always there teaches the eye to stop reading it.

---

## Layout

**The header is two bands, doing different jobs.** The header says what the page
*is* — breadcrumb, title, page-level actions. The toolbar beneath says what you
are *currently viewing* — search, filters, counts. Page identity does not change
when you filter, so it should not share a band with the filters.

**The toolbar is sticky; the header is not.** A filter you cannot reach without
scrolling up is a filter you re-apply from memory. A title you have already read
is not worth 60px of a dense table's vertical space.

A compact-on-scroll header was built and rejected — on pages of this length it
never diverged enough from the plain version to earn the machinery.

**A detail page is two columns: what is *true* about the record on the left,
what *happened* to it on the right.** It generalises across every record here —
a staff member has a rate left and days worked right, a customer has a balance
left and movements right, a product has its recipe left and movements right.

It beat a tabbed layout on one argument: **a figure sits directly above its own
arithmetic**, which tabs cannot do without repeating the figure.

**Editing is a sheet over the record**, never a separate page or a mode. The
record stays visible behind it, there is no navigation to undo, and the same
form component serves create and edit.

**A tab is a list; a record opens from it.** A tab that opens straight into one
record is a detail page pretending to be a list, and it strands every other
record behind no route at all.

**Hierarchy comes from weight and surface, not colour.** A page where every block
is an identical bordered white card has one hierarchy level, and it reads as flat
however good the individual blocks are. Give surfaces different weights — recede
what is a source, bring forward what is being worked on, fill what is the output.
Reaching for colour to fix flatness spends the accent budget on a problem that
weight solves for free.

---

## Colour

**The accent is the client's brand purple**, locked from their palette
(`--color-brand-primary` and its ramp in `globals.css`) rather than chosen from
the earlier dataviz-validated shortlist. It sits far enough from all three
semantic colours — red danger, green success, amber warning — that a primary
button is never mistakable for a state.

**The brand colour and the accent are allowed to differ.** A logo lives on white
at large size; an accent must clear 4.5:1 at 14px and survive hover and disabled
states. Derive a ramp from the brand hue rather than using the brand hex.

**Never two filled primaries on one screen.** That means the primary action was
never decided. Where a page has a figure and an action that settles it, the
action belongs beside the figure, not in the header.

**A row action is outline, never filled.** A filled button repeated down forty
rows reads as forty things to do, not one.

**The rail carries the brand identity.** It is the one surface visible on every
admin screen, which makes it the cheapest place to give the software an
identity. Inside it the accent appears twice: the logo mark, and a rule marking
the current position. Both mark rather than invite.

**Gold is a companion accent, dark surfaces only.** `--color-brand-accent`
(`#eabf63`) appears only on brand-purple grounds — the login header/footer —
for links and small marks. It never appears on a light page.

**Dark grounds get contrast-checked, never eyeballed.** Muted 13px labels on the
rail clear AA at 7.29:1; that headroom is what makes them legible at all.

**Semantic colours mean what they say.** Red is a shortfall or a destructive
action, green is agreement, amber is a warning. Never decorative. In a system
about money, a discrepancy must read as a discrepancy at a glance.

**No colour-coding of locations.** A per-location accent rail was built and
removed: it solved a problem not known to exist and spent the accent budget doing
it. If mis-located entries turn out to be real, a location chip in the header is
the honest fix, because it can be read rather than learned.

**Do not colour-code a category with many values.** Eight colours across a
thousand audit rows is a rainbow that teaches nothing. Give weight to the two
row types that matter instead.

---

## Figures and their arithmetic

**A figure and its composition sit together.** Not the figure in a stat row and
the breakdown elsewhere on the page.

**A sequence of related figures is one instrument, not several widgets.** Where
figures form an arithmetic — revenue − cost of goods − operating costs = net
profit — they are drawn as a continuous band: hairline dividers rather than
borders, proportion bars flush to the cell edges, selection lifting to a raised
surface with a rule in the term's own colour, and explicit operators between
cells.

**Cost of goods sold and operating costs carry weight.** They are the two terms
Lucy can act on — revenue is the market's answer, but what she pays for stock and
burns on gas are hers to change.

**A summary strip states, and links where a link exists.** Stating is the
default: a tile that only points elsewhere answers nothing. Where a record
genuinely explains a figure, the link rides *alongside* it rather than replacing
it. Where no deeper record exists — a "low stock" count that is this same table
filtered — there is no link, because it would point back at itself.

**A summary strip that repeats what an alert already says is deleted.** Two
statements of one fact make the weaker one read as filler.

**Absences are listed, not summarised.** A list of three recipes hides that
twelve dishes are sold at unknown cost. A list of fifteen with twelve blank
states it, in the place someone would fix it.

**Provisional figures are marked wherever they appear**, and the reason is stated
once rather than badged five times. See `docs/formulas.md`.

**A cost that is unknown renders as "—", never as zero.** Cooked food without a
recipe has no per-unit cost, so its profit cannot be stated. Showing zero would
assert something false.

---

## Ledgers and tables

**"Ledger" is the record; "table" is the component showing it.** Use the
accounting word: it says *complete record* in a way "movements" does not.

**One row per subject, movement types as columns.** Opening on the left, closing
on the right, so reading a row left to right is doing the calculation. All four
ledgers share this shape deliberately — an early cash ledger listed one row per
transaction and read as a different kind of record entirely.

**Column groups get header spans**, but only for tables wide enough to need
regions. A five-column table that freezes its first column is solving a problem
it does not have.

**A period aggregates to one row per subject, not thirty.** Six rows when
scanning, thirty when investigating.

**Child rows are visually distinct but recessive** — a spine anchored under the
parent's chevron, smaller muted type, and a closing edge beneath the last child.
Without the closing edge an expanded block bleeds into the next parent.

**Product rows split by location.** A combined row would hide which location
holds the stock, which is the first thing a count needs to know.

**Every ledger is searchable and filterable, and the first column is frozen** so
horizontal scrolling never costs the subject's identity.

**Counts state both numbers when filtered** — "12 of 47", never a bare "12". A
bare count after filtering cannot be told apart from a short table.

**Pagination, not infinite scroll, on any trail people search.** An infinite
scroll has no addresses; "about two hundred rows down" is not a location.

---

## Charts

**Charts answer what a figure cannot.** A single value plus its trend is a **stat
tile with a sparkline**, not a chart.

**One axis, always.** Two y-scales invent a correlation that is not in the data.

**No pie charts on the dashboard or ledger** — a decision about *this* data, not
a general rule. Lucy's questions are about level, and the waterfall already
carries the one proportion that matters. A pie cannot mark an estimated segment
as estimated. Where a future screen genuinely asks a part-to-whole question with
comparable segments, a pie may be right.

**Emphasis over categorical** where one series is the point.

**Closed days are gaps, not zeroes.** A zero on a closed day is a lie about
trading.

Chart construction follows the `dataviz` skill — load it before writing any chart
code.

---

## Forms and entry

**Single column, labels above, sections past ~8 fields.** A placeholder is not a
label; it disappears exactly when it is needed.

**A hint explains consequence, not the label again.** "Applies from today; past
days keep the rate they were worked at" is a hint. "Enter the daily rate" is not.

**Validation on blur. Errors next to the field. Input preserved on failure.** A
form that clears is unforgivable in a system people enter money into.

**A locked field states why, rather than disappearing.** A manager should be able
to see that a pay rate exists and that it is not theirs to change. Hiding it
teaches nothing; disabling it with a reason teaches who to ask.

**The till is the speed-critical screen and stays uncluttered.** Anything added
to it costs money in dropped speed. The customer field appears only when the mode
or a credit payment line actually requires a named customer.

**Payment is a list of lines, not a single value.** Splitting is typing in the
second box rather than clicking a "split" step to reveal it.

**Fulfilment and payment are independent.** Counter/delivery is one question and
cash/M-Pesa/credit is another.

**Large tap targets on the staff shell.** A product grid, not a list — a list is
denser but far more error-prone under a thumb, mid-service.

---

## Records that must not move silently

**Recipes are effective-dated versions, never edited in place.** A recipe's
per-unit cost is baked into every profit figure derived from it. Editing it would
restate what last month cost, which is exactly the "figures that move silently"
`architecture.md` rejects. A change is a new version from a date; past movements
keep the version they were costed with. This is why a recipe has a version
history rather than an edit form.

**The same rule applies to any figure a closed period depends on.** A correction
carries an effective date in the past and its own entered date, and the gap
between them is the information.

---

## Controls

**The handover count is blind.** The staff member sees no expected figure — not
on the handover screen, and not on the home screen either. A shown expectation is
a target to reconcile *to*: someone short by 250 who can see 8,400 has been
handed the number to type. The count must be an independent observation or the
comparison proves nothing.

**A blind count needs a confirm step**, because the staff member loses the
ability to catch their own miscount. Figures are echoed back in words as they are
typed, and repeated back large before committing. That is the only feedback a
blind count permits, and a typo is the failure it actually has.

**The staff member is told the check happens, not its result.** Concealing that a
count is checked would be a trick, and a control people know about deters as well
as detects.

**A shortfall does not block.** A day closed while not balancing is recorded, not
blocked. Blocking produces a cashier who quietly adjusts the count until it
agrees, which destroys the record.

**Cash and M-Pesa are counted separately and never pooled.** A single "total
handed over" box would let a cash shortfall hide behind an M-Pesa surplus.

**Staff record; the owner confirms.** Only the owner *pays*, which is not the
same as only the owner *records*. Staff entries arrive as pending.

---

## Required states

Every list, table and detail view has five, and the distinctions are
load-bearing:

- **Empty — first use.** Says what goes here and how to create the first one.
- **Empty — no filter results.** A *different* message, with "Clear filters".
  Never offer "create your first one" to someone who has four hundred and
  filtered wrong — it suggests the system lost their data.
- **Loading.** A skeleton at the real dimensions, holding the shape of what is
  coming, so the page does not jump on arrival. Never a spinner.
- **Error.** Plain language, a retry, and an explicit promise that filters and
  input were preserved.
- **Permission-denied.** A stated reason and who to ask. Never an enabled control
  that errors on click, and never a silently missing section — a gap with no
  explanation reads as a bug.

---

## Mobile

**Portrait is the default; landscape is offered, never forced.** On narrow
screens a prompt offers a full-width expanded table. She may be holding the phone
one-handed for a reason.

**The admin shell degrades rather than becoming a third shell.** Summary figures
become cards; tables scroll horizontally with the first column frozen. The rail
becomes a drawer carrying the same groups, scope and figure — not a different
navigation.

**On the staff shell the primary action owns the bottom edge.** Nothing
persistent may sit there. This is the deciding argument against a bottom tab bar
in this app: the thumb is at the bottom, and "Complete sale" needs that space
more than navigation does.

---

## The rule that keeps this true

**New UI composes existing components and page templates. It never invents a
pattern.**

When a ticket needs a pattern that does not exist yet, **stop and ask** rather
than inventing one. A single invented pattern is invisible; twenty of them are
the reason enterprise software looks the way it does.

**A shape used by exactly one destination is a page, not a template.** The
recipe builder — two panels with a pinned cost — is a page. It has a story so a
future ticket can see it exists rather than inventing a third editor shape.

Templates live in `src/components/patterns/`. Shells live in
`src/components/design/shell/` and `src/components/design/staff/`. Every one has
Storybook stories covering its states; read those before building a new screen.
