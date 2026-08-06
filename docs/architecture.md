# Architecture — Prosper Hotel

Decisions, and the reasons behind them. Reasons do not go stale even when code moves.

Vocabulary is in `CONTEXT.md`. Scope is in `docs/scope.md`. Every financial calculation is
in `docs/formulas.md`.

---

## The cutting dimension: location

**Location cuts through the entire system.** It is an entity, not an attribute.

Nearly every other concept is meaningless until the location is known — stock, sales,
cash, handovers, staff postings. Location has its own paybill, its own stock, its own
staff and its own daily close.

Three consequences, settled deliberately because retrofitting any of them is expensive:

- **It scopes permissions.** Staff see their own location only. The owner sees both.
- **Transfers are visible at both ends.** "Own location only" means *own location, plus
  transfers involving it* — the canteen must see food coming from the restaurant.
- **Stock moves in both directions.** The restaurant sends prepared food to the canteen;
  the canteen sends printing stock back. Two stocking points supplying each other, not a
  hub and spoke. A transfer is one movement out and one movement in.

### The two locations record trade differently

This is not a preference to be configured away. It follows from how each location physically
trades, and the system accommodates both rather than forcing one shape on the other.

| | Restaurant | Canteen |
|---|---|---|
| Sales | Recorded individually, as they happen | Not recorded individually |
| Money | Sum of the day's sales | **Takings** — cash and M-Pesa totals, entered at close |
| Stock count | Daily | Cooked food daily; own goods weekly |
| Item detail | From the sales themselves | **Derived** at the weekly count |

**Why the canteen cannot record sales as they happen.** Students arrive in a rush. The
attendant is serving and handling money, not operating a phone. She reads M-Pesa messages as
she distributes items. Requiring per-sale entry would produce invented data, which is worse
than honestly coarse data.

**Why the canteen counts weekly.** Its stock is packaged goods in quantity — a box of
biscuits, a carton of sweets. Counting them daily is a chore with no daily payoff. Weekly is
normal for retail of this kind.

**What the canteen gives up, accepted deliberately:**

- **Daily canteen profit is provisional** — the cost of restaurant-supplied food is exact, the
  cost of canteen-only goods is estimated between counts and corrected at each one. Revenue
  and cash position remain daily and exact.
- **Low-stock warnings are stale** — accurate on count day, drifting afterwards.
- **A weekly variance has several possible causes** — theft, breakage, miscounting — and the
  single number cannot separate them.

**What still holds.** Two controls at two frequencies: money checked daily, stock checked
weekly. M-Pesa is independently verifiable at both locations because the messages are
evidence the attendant does not author. Sustained cash shortfall surfaces at the weekly count
even though a single day's cash cannot be verified.

**Credit sales are always recorded individually, at both locations.** A debt needs a named
customer and cannot wait a week for a count.

---

## Modules

Six. Each is a part of the business the client would recognise, described in her own words.

| Module | Owns | The client's words |
|---|---|---|
| `catalogue` | Products, ingredients, recipes, prices | "what I sell and what it costs" |
| `stock` | Movements, daily closes, counts, transfers | "what's on my shelves" |
| `sales` | Sales, payment lines, customers, credit | "what we sold and who owes me" |
| `cash` | Handovers, expenses, the running balance, drawings | "where the money is" |
| `people` | Staff, days worked, pay, access | "my staff and what I pay them" |
| `reporting` | Profit, stock valuation, the item history, the audit trail | "am I making money" |

**Why `cash` is separate from `sales`.** Money taken at the till and money sitting in the
owner's pocket are different questions, and she said so herself. Sales answers *what did we
sell*; cash answers *where is the money*. A business can sell well and still have cash
unaccounted for — separating them is what makes that visible rather than hidden.

**Why `reporting` owns no data.** It reads from everything and stores nothing, which is
usually a smell. It earns its place here because profit spans stock cost, sales revenue and
expenses, and that join has to live somewhere. **It reads through other modules' interfaces,
never their internals.**

**The audit trail is not a module.** Every module writes to it, so it is a shared
foundation capability rather than a part of the business. It is *read* through `reporting`.

---

## Seams

Six, one per module — the module interfaces listed above.

**Tests observe behaviour at these six seams and nowhere else.** No test is written against
a module's internals. If something can only be checked by reaching past an interface, the
module is the wrong shape.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| App | Next.js, as a PWA | One codebase, installs to a phone from a link, no app store. Staff use their own phones. |
| Language | TypeScript | The domain is money and stock; types catch real errors. |
| Database | PostgreSQL | The movement ledger and daily closes need real transactions. Non-negotiable for accounting. |
| Data access | Drizzle | SQL-shaped. The reports here are genuine SQL, not object graphs. |
| Auth | Owned, in `people` | Access is location-scoped and role-shaped in a way off-the-shelf auth fights. |
| Hosting | One host, app and database together | Solo developer. Splitting hosts creates a preview-deployment problem for no gain. |

**Online only.** Offline sales were considered and rejected: connectivity at both locations
is reliable in practice, and offline sync is a large amount of work to solve a problem this
business does not have. If that changes, sales are append-only and therefore the safe thing
to make offline-capable first.

---

## Identity and access

**Four roles**, drawn from how the business actually runs rather than invented:

- **Owner** — everything, both locations. The only role that corrects stock, pays money out,
  changes a closed day, sets prices, and manages staff.
- **Store manager** — stock at the restaurant: receiving, issuing to the kitchen, transfers.
  Records delivery orders. **Does not work the till.**
- **Cashier** — selling at their location, and recording wastage they observe.
- **Attendant** — the canteen, single-handed: sells, receives transfers, receives deliveries
  direct from suppliers and records what they cost, sends stock back, keeps stock records.
  Effectively cashier and store manager for one location.

**Both locations receive from suppliers.** Goods arrive at the restaurant's main store and
also directly at the canteen, which stocks packaged goods a supplier can drop off. Receiving
is therefore a capability of the store manager *and* the attendant, each at their own
location — not a restaurant-only action.

**Recording a receipt is not paying for it.** The attendant records stock arriving and its
cost; the money leaving remains the owner's [[Cash Movement]]. This preserves the single
expected-cash balance, which depends on only one person paying money out.

**The owner works any position when present.** Capability is therefore not "owner sees
reports" — she must be able to do everything her staff can do, plus what only she can do.

**Login is a phone number and a four-digit PIN.** Staff use their own phones and log in
mid-service with customers waiting; an email and password is friction that gets worked
around. The accepted risk: a shared or observed PIN weakens attribution, and attribution is
the basis of the handover control. Mitigated by making activity visible per person rather
than by hardening the login.

**Staff are managed by the owner** — added, deactivated, rates and roles set. **Deactivated,
never deleted:** a former employee's sales must stay attributed to them.

---

## Data lifecycle

**Nothing that moved stock or money is ever deleted.** But mistakes are common and must be
fixable in seconds, mid-service. These are not in tension — the distinction is *how*.

- **Reversal, not deletion.** A wrong sale is voided: a reversing entry returns stock and
  cash to where they were, and the original stays readable, marked void, attributed.
- **Void your own entry, same day, before close** — any role, no permission needed. This is
  the common case and it must be fast.
- **After the day is closed** — owner only.
- **Non-financial typos** — a misspelled name, a wrong phone number — are edited in place,
  keeping the previous value. Not worth a reversal.

**Voids are shown on the day's summary.** An undo the owner cannot see is a way to hide a
mistake; a cashier with fifteen voids in a day should be visible. Visible rather than
blocked, because blocking it makes the system unusable.

### Changing a closed day

The owner does not edit closed figures. She records a **new entry that carries an effective
date in the past**, with a reason and attribution. The closed day keeps its original numbers.

**Every entry carries two dates: effective and entered.** Normally identical. For a
correction they differ, and that gap is the information — it distinguishes "what Tuesday
looked like on Tuesday" from "what Tuesday looks like now". Both are answerable.

Editing the figure directly was rejected because the handover was already checked against
it, because the client's bar is "the past readable exactly as it happened", and because an
audit trail over figures that move silently is worthless.

### Stock levels

A stock level is **not a stored number**. It is the sum of the movements.

For speed, each location freezes a **daily closing balance per item** at close. Current stock
is last night's close plus today's movements. This is not only an optimisation — it is
exactly the client's existing Excel shape (opening, added, transferred, sold, wasted,
closing) and it gives the daily physical count something to compare against.

**A day closes even when it does not balance.** The discrepancy is recorded, not hidden, and
an unexplained gap never blocks the next day's trading.

**A physical count never silently overwrites the record.** It records what was counted and
shows the difference. Correcting the record is a separate, deliberate act — and **only the
owner may correct.** The person who counts is not the person who adjusts.

---

## Integrations

**None in v1.** M-Pesa payments are recorded by hand as payment lines against a sale. There
is no paybill integration and no automatic reconciliation.

Recorded explicitly because it is the obvious next integration: two paybills, one per
location, and matching statements to recorded sales would strengthen the handover control.

---

## Environments and deployment

One host, application and database together. A single production environment plus local
development.

**No staging in v1.** A solo developer and an environment nobody looks at is cost without
benefit. Because the stack is not split across hosts, the preview-deployment problem — a
preview frontend pointing at a production backend — does not arise.

---

## Observability

Error tracking with alerts to the developer. The client should not be the one who discovers
the system is broken. Cheap, and worth it for a business that trades daily.

---

## Non-functionals

Five users. Two locations. Roughly 150 sellable lines. A few hundred sales a day at most.

Kenyan Shillings throughout. Cash and M-Pesa tracked separately, never pooled. No regulatory
or compliance constraint beyond keeping honest records.

**Recorded explicitly to license not over-engineering.** This system does not need
scale architecture, caching layers, or horizontal anything. Correctness and speed of entry
matter; throughput does not.
