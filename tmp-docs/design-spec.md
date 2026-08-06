# Design spec — Prosper Hotel

Working document for the design phase. Lives outside the repo. The durable parts
land in `docs/design.md` at lock.

Started 6 August 2026. Rewritten 6 August after `/tmp` was cleared — content
carried forward from the version read earlier in the session.

---

## Shells

Two, settled at setup.

| Shell | Who | Device | Tasks |
|---|---|---|---|
| **Staff** | Store manager, cashiers, attendant | Phone, one-handed, mid-service | Till, takings, receiving, issuing, transfers, counts, wastage, handover |
| **Admin** | Lucy | Laptop at home; phone on site | Dashboard, ledger, stock, money out, people, catalogue, activity |

**Why two, not responsive.** A cashier taking a sale on a phone with customers
waiting is not doing a small version of Lucy's profit report — it is a different
job. The till is thumb-driven and one-handed; the ledger is a dense
multi-column table. One adaptive shell would serve both badly.

**Lucy uses both.** The shell follows the task, not the role.

---

## Destinations

| Destination | Rounds | State |
|---|---|---|
| Till | 2 | **Settled** — do not rebuild |
| Dashboard | 3 | **Settled** |
| Ledger | 3 | **Settled** |
| Admin shell | 2 | **Settled** — Rail nav, brand-tinted ground, two-band header |
| Staff shell | 1 | **Settled** — Launcher |
| Stock | 1 | **Settled** — carried the frame round, then rebuilt on `RecordTable` |
| Catalogue | 1 | **Settled** — four tabs; recipe Builder; list-then-record |
| People | 1 | **Settled** — Aside detail; staff/customers tabs added after the merge |
| Money out | 0 | **Built from templates** — the record-table proof |
| Activity | 0 | **Built from templates** — the volume proof |
| Staff pages other than handover | 0 | Not prototyped. Receiving, issuing, counts, wastage, takings are forms; the form primitives exist, so they should compose. **Assumed, not proven** |

---

## Templates

Derived from the shapes destinations **share**, not from a generic list. A shape
used by exactly one destination is a page, not a template.

| Template | Destinations needing it | Lives in | State |
|---|---|---|---|
| Admin shell | all 7 | `design/shell/admin-shell.tsx` | **Settled** |
| Page header + toolbar | all 7 | `design/shell/headers.tsx` | **Settled** |
| Summary strip | Stock, Money out, People, Activity | `patterns/summary-strip.tsx` | **Settled** |
| The five states | everything | `patterns/states.tsx` | **Settled** |
| Detail page | People, Catalogue | `patterns/detail-page.tsx` | **Settled** — Aside |
| Form primitives | Money out, Catalogue, People | `patterns/form.tsx` | **Settled** |
| Record table | Stock, Money out, Activity, People | `patterns/record-table.tsx` | **Settled** |
| Table toolbar | every table page | `patterns/table-toolbar.tsx` | **Settled** |
| Staff shell | all staff pages | `design/staff/shell-home.tsx` | **Settled** — Launcher |
| Summary page | Dashboard only — a page, not a template | — | n/a |
| Ledger page | Ledger only — a page, not a template | — | n/a |

**Proof they work:** People was rebuilt from `DetailPage` + `DetailCard` +
`FactList` + `EditSheet` and Stock from `SummaryStrip` + the states, neither
inventing anything.

**The test at lock:** could `/build` make Money out, People, Catalogue or
Activity without inventing anything?

---

## Locked

| Decision | Round | Choice — in the user's words |
|---|---|---|
| Shells | Setup | Two. Staff on phones mid-service; owner on laptop at home and phone on site |
| Navigation is the unit | Setup | Judged by nav links per person. "When I see 45 screens, I panic because I can't imagine having 45 navigation links" |
| Admin destinations | Setup | 7: Dashboard · Ledger · Stock · Money out · People · Catalogue · Activity |
| Dashboard absorbs profit + cash | Setup | "Those should not be separate screens. They can easily fit into the dashboard screen" |
| Ledger is the explanatory page | Setup | "Where if she needs to make sense of financial data, she should be able to come to this ledger page and look at all those tables and understand how the financial values come to what they are" |
| Assets in Catalogue | Setup | A register of what the business owns. An asset previously existed only as an expense category |
| Staff record expenses, owner confirms | Setup | Only the owner *pays*, which is not the same as only the owner *records*. Staff entries are pending until Lucy confirms |
| Till: product grid, large tap targets | 1 | "I love the large tap surface… very easy for the user just to tap easily." A list is "prone to much more mistakes" |
| Till: search top, categories below | 1 | "I love how it's arranged, the search bar at the top" + category pills after it |
| Till: payment lines, amounts typed directly | 1 | "They can split payments however many times they want." No split step — "the inputs were there and they were ready" |
| Till: no customer in the counter flow | 1 | "I don't like the customer part. It should not be part of this flow" |
| Accent used sparingly — one per screen | 2 | Round-two till had 11 accent elements; "Complete sale" was off-screen while tapped cards shouted. "Have we overdone it?" |
| Dashboard: figure with its arithmetic beside it | 2 | "Very good visual hierarchy, and I can see what makes up those figures… I like the UI that tells them, open the ledger, so she can go and verify" |
| Dashboard: COGS and running costs weighted up | 2 | "I would argue that the cost of goods sold and the running costs matter more, they matter very much" |
| Ledger: tabbed layout, four sub-ledgers | 3 | "I love the tabbed layout." Product · Store · Non-sales · Cash |
| Ledger: one row per subject, movements as columns | 3 | One row per transaction "made cash look like a different sort of thing" |
| Child rows: spine, recessive, closing edge | 3 | "A bit distinct but yet subtle" |
| Accent: violet | 3 | Validated shortlist. Teal, green, amber ruled out — each collides with a semantic colour |
| Typography unchanged | 3 | "I love the typography. I wouldn't change anything about it" — Geist, 13px body |
| **Admin nav: left rail, collapsible** | A | Rail chosen over top-nav and a ⌘K workbench. Collapse persists |
| **Rail ground: brand-tinted dark** | B | "I like the dark sidebar… let's go with the brand tinted dark." Violet at low chroma, contrast-checked at 7.29:1 for muted labels |
| **Collapse control at the top** | B | "The collapse button should not be at the bottom because it coincides with the taskbar in most desktops" |
| **Nav grouped: Today / Records / Setup** | B | Seven flat items is a list; three groups is a structure |
| **Location scope lives in the rail** | B | It cuts every destination, so it belongs in global chrome |
| **Header is two bands** | B | Header = what the page is + actions. Toolbar = what you're currently viewing. Toolbar sticky, header not |
| **Compact-on-scroll header rejected** | B | "I don't really see much difference between the toolbar and compact." Never diverged on pages of this length |
| **The four missing states exist** | B | Loading skeleton at real dimensions, error preserving filters, permission-denied with a stated reason, first-use distinct from filter-empty. "I've seen the error states, they are good" |
| **Summary strips state, and link where a link exists** | C | "Summary strip states, that's the best option… where there is an option to link, let's also include the link option." Stating is the default; the link rides alongside the figure rather than replacing it |
| **Detail page: Aside** | C | "I have loved the aside variant… I love the edit mode. I love the information density and how there's proper visual hierarchy in the page and the right things stand out really well." Identity left, history right |
| **Editing is a sheet over the record** | C | The record stays visible behind it, there is no navigation to undo, and the same form serves create and edit |
| **A figure sits directly above its own arithmetic** | C | Aside was chosen partly because tabs cannot do this without repeating the figure. Confirms the principle generalises beyond the dashboard |
| **No two filled primaries on one screen** | C | The rules scan caught "Pay Sarah" in both the page header and the body. The body one wins — it sits beside the arithmetic that justifies the amount |
| **Staff shell: Launcher** | D | "Let's go with launcher because there aren't that many links." Home screen in, back arrow out, task owns the whole screen. Tab bar rejected — it fought the primary action for the bottom edge and could not hold six links; drawer rejected — it assumed a till underneath that Anne does not have |
| **The primary action owns the bottom edge** | D | On a phone the thumb is at the bottom. Nothing persistent may sit there — this is the deciding argument against a tab bar in this app |
| **Admin on mobile is the rail in a drawer** | D | "The admin, on mobile, would benefit from the sidebar because the admin has many pages." Same rail, not a different navigation. Seven destinations across three groups plus a location scope cannot reduce to four tabs and a "More" |
| **The two shells navigate differently on purpose** | D | Admin drawer-rail, staff launcher. They have genuinely different amounts to navigate — 7 grouped destinations against 3–6 flat tasks |
| **The handover count is blind** | D | "The client actually wants it blind so that she's the one that sees the expected figure and not the staff." A shown expectation is a target to reconcile *to*; the count must be an independent observation or the comparison proves nothing |
| **A blind count needs a confirm step** | D | The staff member loses the ability to self-correct, so the screen makes counting careful instead: figures echoed back in words and large, with one way forward and one way back |
| **Staff are told the check happens, not its result** | D | Concealing that a count is checked would be a trick. A control people know about deters as well as detects |
| **Customers move from Catalogue to People** | E | "We should move customers to people already." A customer is not reference data — it is a live balance moving with every credit sale and repayment. Catalogue drops to four tabs; People becomes staff *and* customers |
| **Recipes are effective-dated versions, never edited** | E | A recipe's per-unit cost is baked into every profit figure derived from it. Editing in place would silently restate what last month cost — the "figures that move silently" architecture.md rejects. A change is a new version from a date; past movements keep the version they were costed with |
| **Recipe editor: Builder** | E | "The workflow has a very good user experience… it's spacious so you can read comfortably, and you can edit the quantities comfortably." Storeroom left, recipe centre, cost pinned right. A page, not a template — the shape exists nowhere else |
| **Hierarchy comes from weight and surface, not colour** | E | The flat page was diagnosed from a screenshot: every block an identical white card, so only an amber alert stood out. Fixed by giving three columns three weights — picker recessed on muted ground, recipe forward on white, cost panel filled dark. No accent spent |
| **A tab is a list; a record opens from it** | E | "Shouldn't there be a recipe list as well?" The recipes tab opened straight into editing one dish with no way to reach the others — a detail page pretending to be a tab while its three siblings were lists |
| **Absences are listed, not summarised** | E | The recipe list shows all fifteen cooked dishes, twelve of them greyed with "not recorded" and an Add button. A list of three recipes hides that twelve dishes are sold at unknown cost; a list of fifteen with twelve blank states it, in the place someone would fix it |
| **A summary strip that repeats an alert is deleted** | E | The strip said "12 without a recipe" and the alert beneath said it better. Removing the redundant band was the cheapest hierarchy win available |

---

## Open

| Question | Round raised | State |
|---|---|---|
| Live figure in the rail footer | B | Cash-you-should-hold sits in the sidebar. Makes nav ambient rather than furniture; may pull attention from the page. Not reacted to |
| Standalone table page shape | B | Stock carried the frame round, so the table itself was never the subject. Toolbar placement settled; row treatment, drill-down and row actions are not |
| Does Aside scale to Catalogue? | C | Aside won on a record with five days of history. A product with a recipe and hundreds of movements, or a customer with a long purchase history, may want the same shape or may not. Tested when Catalogue is built |

---

## Not yet shown

**Required states** — all four now built on Stock, and need carrying into every
later template.
- ~~Empty — first use~~ · ~~Loading~~ · ~~Error~~ · ~~Permission-denied~~
- Empty — no filter results ✓ (existed already: till grid, ledger tables, Stock)

**Still never built anywhere**
- A detail view of any record
- A form of any kind outside the till
- Any staff-shell page other than the till
- Long text — a 200-character product name
- Many items (1000+) — the activity trail will get there
- Bulk selection and bulk actions

**Domain stress cases**
- A cooked-food product with no recipe — no per-unit cost ✓ (shown on Stock: "—")
- A provisional figure marked as provisional ✓ (dashboard, ledger)
- A handover that does not agree ✓ (dashboard)
- A sale split across cash and M-Pesa ✓ (till)
- A voided entry shown on the day's summary, attributed
- A correction with an effective date in the past, distinct from entered date
- Stock in transit — visible at both ends before it is received
- A day closed while not balancing — recorded, not blocked

---

## Reference brief

Not run. `/design references` is user-invoked only.

---

## Handover — 6 August 2026

The design phase is closed. `docs/design.md` carries every durable decision
with its reason; this file was the working document and is yours to keep or
bin. Moving it into a personal design library is worth it — the locked
decisions accumulate into a house style across projects.

**Never copy it into the repo.** It describes an in-flight phase, which is
exactly what goes stale.

### What was never tested — the honest record

- **Staff pages other than the handover.** Receiving, issuing, counts,
  wastage and takings were never prototyped. They are forms, the form
  primitives exist, and they *should* compose — but that is an assumption,
  not a proof. If the first one needs a new pattern, that is the stop rule
  working, not a failure.
- **1000+ rows for real.** Activity is designed for volume and paginated,
  but the fixture holds twelve entries. Nothing has been rendered against
  the real thing.
- **Bulk selection and bulk actions.** No screen has them. If a ticket wants
  to confirm six expenses at once, that is a new pattern and needs asking
  about.
- **A 200-character name outside Stock.** `Truncate` handles it and the
  fixture carries one, but only the stock table was looked at.
- **Stock and People were not audited** for the flat-cards problem
  diagnosed on Catalogue in round E. Both were built before that diagnosis
  existed and may have the same even-weight surfaces.
- **Domain cases still unbuilt:** stock in transit visible at both ends, a
  day closed while not balancing, a voided entry on the day's summary.
  Fixtures exist for the last two; no screen shows them.

### Still in the repo, deliberately

The variant switcher and accent switcher remain on main at the user's
instruction. The state switchers on Stock, Money out, People and Activity
remain too — they are dev-only and hidden in production. All of them go when
the user says.

Losing variants are on `design-variants-archive`.
