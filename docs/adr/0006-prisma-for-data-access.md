# 0006 — Prisma for data access, with raw SQL for the aggregates

**Date:** 2026-08-06
**Status:** Accepted

## Context

The original stack decision named Drizzle, on the reasoning that this domain's hard queries are
SQL-shaped: a stock level is the sum of a movement ledger, weighted average cost is recalculated
on every receipt, cost of goods sold spans two locations with transfers netting between them,
and canteen sales are derived from the movement between counts. Drizzle keeps those queries
close to SQL, where they can be read against `docs/formulas.md` line by line.

That reasoning assumed the SQL would be read and maintained by hand. It will not be. The
developer works through agents for query authoring and does not write SQL directly. The
readability advantage therefore accrues to a reader who is not there, while the costs of
Drizzle — hand-managed migrations and no visual browser — fall on the developer directly.

The developer has prior experience with Prisma and none with Drizzle.

## Decision

**Prisma** for schema definition, migrations, and ordinary reads and writes.

**Raw SQL via `$queryRaw`** for the aggregate calculations in `docs/formulas.md`: running stock
balances, weighted average cost, cost of goods sold, and derived sales.

This split is deliberate rather than a workaround, and is the second half of the decision rather
than an afterthought.

## Alternatives considered

**Drizzle, as originally decided.** Keeps every query in SQL-shaped code and needs no escape
hatch. Rejected because its principal benefit is legibility to a hand-author of SQL, which does
not describe how this project is being built, while its costs — manual migration files, no data
browser — are borne by the developer on every schema change.

**Prisma throughout, with aggregates assembled in JavaScript.** Would avoid raw SQL entirely by
loading movement rows and summing them in application code. Rejected on two grounds. It does not
scale: a stock level derived from years of movement rows would load thousands of records to
produce one number, which is precisely what the daily closing balance in ADR 0001 exists to
avoid. And it moves the money calculations out of one checkable place and into imperative code,
where their correspondence to `docs/formulas.md` cannot be verified by reading.

## Consequences

**Good.** Migrations are generated from schema diffs rather than written by hand. The schema is
a single readable file describing the whole database, which matters for a domain with a movement
ledger, two locations and dual-dated corrections. Prisma Studio provides a visual browser, which
is directly useful for confirming that a stock movement or a correction recorded as intended.
Documentation and community answers are more plentiful, which matters for a solo developer.

**Bad, and accepted.** The data access layer has two idioms rather than one: Prisma's client for
ordinary work, raw SQL for the aggregates. Any developer joining must know both, and must know
which calculations belong on which side.

Prisma's relational query API makes the JavaScript-side aggregation path look idiomatic. It is
the wrong shape for this domain, and the temptation is real. **The financial calculations named
in `docs/formulas.md` are written as SQL and are not to be reimplemented in application code.**

**Reversible at a cost.** Schema and migration history are Prisma's once the first migration
runs. Moving to another tool later would mean re-expressing the schema and taking over an
existing migration history — meaningful work, though it is bounded and touches no business
logic, since the aggregate queries are already plain SQL and would carry across unchanged.
