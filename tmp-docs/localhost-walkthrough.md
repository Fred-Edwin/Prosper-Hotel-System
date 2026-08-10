# Localhost walkthrough — what's actually built (tickets 01–17)

Follow this in order. It logs you in as each role and exercises every real
feature that's shipped so far. Placeholder/not-yet-built screens are called
out explicitly so you don't mistake a stub for a bug.

## 1. Start it up

```bash
docker compose up -d          # postgres — probably already running, harmless if so
pnpm install                  # if you haven't
pnpm prisma migrate deploy    # apply migrations to local DB
pnpm seed                     # wipes and reseeds local DB with the data below
pnpm dev                      # http://localhost:3000
```

## 2. Who you can log in as

Login is **name + 4-digit PIN**, not phone number (`/login`). Every seeded
staff member's PIN is **`1234`**.

| Name | Role | Location | What you'll see |
|---|---|---|---|
| Admin Owner | owner | restaurant | Admin shell — redirects to `/catalogue` today (dashboard exists but the login redirect is a known stopgap, see `docs/gotchas.md`) |
| Store Manager | store_manager | restaurant | Staff shell, 8 links (fullest role) |
| Restaurant Cashier | cashier | restaurant | Staff shell, 5 links |
| Brian Otieno | cashier | restaurant | Second cashier — good for testing "my sales only" scoping |
| Canteen Attendant | attendant | canteen | Staff shell, 7 links, canteen-scoped |
| Peter Kiptoo | attendant | canteen | Second canteen attendant |
| Faith Mumbi | cashier | restaurant | **Deactivated** — try logging in, confirm it's rejected |

Try the **dashboard as owner** deliberately: go to `/dashboard` directly
after logging in (not just wherever login redirects you).

## 3. As the owner — the admin shell

Login → Admin Owner / 1234. Seven nav destinations exist in the shell, but
not all are wired to real features yet:

| Destination | Status | What to check |
|---|---|---|
| Dashboard | **Real** (ticket 14) | Today's handovers from both locations — do this *after* step 4/5 below so there's data to see |
| Catalogue | **Real** (tickets 01–03) | Products / Ingredients / Recipes tabs — add a product, add an ingredient, build a recipe and watch the derived per-unit cost |
| Stock | **Real** (tracer slice) | Read-only valuation table — cost, value, per location |
| Money out | **Real** (ticket 16) | Record an expense in each of the 4 categories: stock, running costs, equipment, drawings |
| People | **Real** (tickets 06, 17) | Staff CRUD (add/edit/deactivate/reactivate) + Customer records |
| Ledger | **Placeholder** | Not built — will 404 or show a stub |
| Activity | **Placeholder** | Not built — the audit trail UI doesn't exist yet |

## 4. As a restaurant cashier — the till

Login → Restaurant Cashier / 1234. 5 links: New sale, Today's sales,
Wastage, Stock, Handover.

1. **New sale** (ticket 07) — ring up a counter sale, split payment across
   cash and M-Pesa lines. Note the second payment line prefills with the
   remaining balance.
2. **New sale → credit** (ticket 08) — same flow, but pick "credit" as a
   payment line; create a customer inline if none exists yet.
3. **New sale → delivery** (ticket 11) — a sale fulfilled as a delivery,
   with a fee and a named customer (this needed customer records to exist
   first, hence built after credit sales).
4. **Today's sales** (ticket 09) — confirm it only shows *your* sales
   today, not Brian's. Log out, log in as Brian Otieno, confirm the list is
   different.
5. **Same-day void** (ticket 10) — from Today's sales, void one of the
   sales you just made. Confirm stock/cash reverse and the original stays
   visible marked void, not deleted.
6. **Wastage** (ticket 15) — record wastage, staff-meal consumption, or a
   complimentary give-away against a product.
7. **Stock** — read-only current stock at your location, computed live.
8. **Handover** (ticket 13) — blind cash/M-Pesa count against the
   system's computed expected amount. Do this last so the day's sales/
   wastage/void above all feed into what it expects.

## 5. As the store manager — stock operations

Login → Store Manager / 1234. Same 5 as cashier, plus 3 more: Receiving,
To kitchen, Stock count.

1. **Receiving** (ticket 12) — record a delivery into the store against an
   ingredient, watch last-known cost prefill where it exists.
2. **To kitchen** and **Stock count** — these are `.work/18` and `.work/20`,
   **not built yet**. If the nav links exist but the destination doesn't
   work, that's expected — they're queued next, not broken.

## 6. As the canteen attendant — the different location

Login → Canteen Attendant / 1234. This is where CONTEXT.md's "canteen
trades differently" becomes visible: no "New sale" link at all — instead
**Takings**, a single daily cash/M-Pesa total rather than per-sale entry.

- **Takings** — as of ticket 17 this is still a nav placeholder (Stage 4,
  "Canteen operations," hasn't started — see roadmap).
- Receiving, Wastage, Stock, Handover work the same way as the restaurant
  side, scoped to the canteen location.

Log in as Restaurant Cashier again and confirm you **cannot** see canteen
stock or canteen sales — location scoping (`canAccessLocation()`) is the
thing to verify here.

## 7. What "done" looks like right now, in one paragraph

The full restaurant-side sales loop is real end to end: sell → show up in
today's sales → void if wrong → feed the day's handover → show up on the
owner's dashboard. Catalogue (pricing, ingredients, recipes) and staff
management are real. Receiving and wastage are real. What's **not** real
yet: issuing to kitchen, production, stock counts (queued — Stage 3's
remainder), all of canteen's actual operations (Stage 4), reporting/
ledger/activity trail (Stage 8, deliberately last since it reads from
everything else).

## 8. Where to go next in code, if you want to see *why* something works

- `src/modules/<name>/index.ts` — the only legal way one module reads
  another; start here to see what a module actually exposes.
- `.work/*.md` — the ticket that specified each screen you just used.
- `docs/roadmap.md` — the stage order and what's deliberately not built.
- `docs/gotchas.md` — known rough edges (e.g. the owner's post-login
  redirect still points at `/catalogue`, not `/dashboard`).
