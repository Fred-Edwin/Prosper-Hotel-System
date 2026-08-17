# Prompt for the reset session

Paste everything below the line into a fresh session, in `~/prosper-hotel`.

---

The client's app is live in production. She spent the weekend entering
trading data that turned out to be inaccurate, and wants to start afresh
today with a clean set of books.

What she said, in her words:

> "Only the Items, Opening, Closing Stock, Buying and Selling price should
> remain."

Concretely: on the ledger right now, African Tea reads opening 32 / closing
32. After the reset it must **still** read opening 32 / closing 32, and the
same for every other catalogue item — current quantities preserved exactly,
prices preserved, all purchases/sales/history gone, so staff start trading
today from the real shelf quantities.

**Before you plan anything, read `docs/data-reset-findings.md` in full.** It
was written by a previous session that investigated this thoroughly but
deliberately shipped no code. It documents five traps that make this
operation non-obvious — the biggest being that **stock is not stored
anywhere, it's derived by summing StockMovement rows**, so a naive delete
takes every item to zero. It also records the verified production
environment, where an earlier attempt lost time on wrong assumptions.

Treat that document as findings, not as a plan. If you disagree with
anything in it after reading the code yourself, say so — it was never
validated against a real run.

## Decisions already made by the owner, don't re-ask

- **No assets and no days-worked were ever recorded.** Assert this and abort
  if either count is non-zero.
- **Customer credit data is not needed.** Delete it, no export.
- **She is not trading during the reset** — she's waiting, so work quickly,
  but the sign-off step below is not optional.
- **Do not rotate `POSTGRES_PASSWORD`.** It's fine as is.

## What I need from you

1. Read `docs/data-reset-findings.md` and the relevant code
   (`src/modules/stock/logic.ts`, `queries.ts`, `prisma/schema.prisma`).
2. Tell me your plan and flag anything in the findings you'd do differently.
3. Write the tooling fresh. Don't assume the previous session's approach was
   right just because it's written down.
4. Run it against production with me, stopping at the checkpoints below.

## Hard requirements

- **Back up first** (`pg_dump`) and confirm the file is a sensible size
  before anything destructive runs. This is the only undo.
- **Snapshot the derived stock before the wipe**, and give me a plain-text
  sheet of the figures to confirm. After the wipe that sheet is the only
  record of the position. **Stop and wait for my confirmation** — I want to
  see African Tea at 32 before anything is deleted.
- **Preflight before wiping**, while aborting is still free: find items with
  no resolvable cost basis, inactive items holding stock, and negative
  quantities. Any of these silently reload as zero or fail a whole location.
- **Support `--dry-run`** on anything destructive, and show me counts before
  the real run.
- **The wipe and the replay are one operation.** Between them every item
  reads zero. Don't pause in the middle, and nobody trades until the final
  verification passes.
- **Verify at the end** against the snapshot, line by line, then confirm on
  the live ledger that African Tea reads 32 / 32 with purchases and sales
  empty.

## Environment — verified, saves you the detour

The droplet has **no source checkout** and the app image is a Next.js
standalone build containing no scripts and no `tsx`. Postgres publishes **no
host ports**. So reset tooling runs **from this laptop over an SSH tunnel** —
laptop has the code, droplet has the data. `psql` isn't installed on either
machine; use Prisma for reads and run `pg_dump` inside the container. Exact
commands are in the findings doc's environment section.

Don't push to `main` until the reset is verified — pushing triggers an
automatic deploy.

## Project conventions still apply

Feature-first modules, `queries.ts` (bare Prisma) vs `logic.ts` (composes and
enforces rules), cross-module imports via `index.ts` only. Call logic-layer
functions rather than raw `db.*` writes wherever an equivalent exists; raw
Prisma is fine for bulk deletes, which have none. See `CLAUDE.md` and
`docs/conventions.md`.

Stop and ask rather than guessing, especially at anything touching real
infrastructure.

## Afterwards

Once the reset is verified, I want to talk about a **stock adjustment
screen** — the owner raised wanting to edit stock figures directly, and the
last session's recommendation (in the findings doc) was that the real gap is
an owner-facing correction screen, not a schema change. I haven't decided
yet. Don't build it as part of this work.
