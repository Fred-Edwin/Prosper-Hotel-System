# 0002 — Location scopes permissions, not just data

**Date:** 2026-08-05
**Status:** Accepted

## Context

The business runs two locations — a restaurant and a university canteen — that are
commercially different: one is a restaurant with a kitchen and the main store, the other
behaves more like a retail shop. Both hold stock, and stock moves between them in **both**
directions.

The owner was explicit that the full picture across both locations is hers to see. No member
of staff needs figures from the location they do not work at.

Location was identified during planning as the system's cutting dimension: stock, sales, cash,
handovers and staff postings are all meaningless until the location is known.

## Decision

Location is an entity, and it scopes **permissions**, not merely data.

A staff member sees their own location, plus transfers involving it. The owner sees both.
This is enforced at the module interfaces rather than applied per query at call sites.

## Alternatives considered

**Location as an attribute, with everyone seeing everything.** Simpler, and adequate for five
users who mostly trust each other. Rejected because the owner stated the cross-location view
is hers, and because widening access later is trivial while narrowing it later is not.

**Filtering by location in the UI.** Rejected as not a permissions model at all — it is a
display convention that any missed call site silently defeats.

## Consequences

**Good.** The rule is stated once and holds everywhere. A future AI query layer reading
through the same module interfaces inherits the scoping automatically rather than needing it
reimplemented — which is precisely the failure mode where an assistant answers a canteen
question with restaurant figures.

**Bad, and accepted.** Transfers are the exception that every location-scoped read must
account for: the receiving location must see stock coming from a location it otherwise cannot
see. This is a genuine special case and it appears wherever transfers do.

The owner works any position when present, so her access is not "sees reports" but "can do
anything her staff can do, plus what only she can do." Roles cannot be modelled as a simple
hierarchy of increasing privilege.

**Hard to reverse.** Retrofitting a permissions model onto a system that never had one means
auditing every read in the codebase. Doing it while the business is live, against a schema
where location was only ever an attribute, is among the most painful changes available.
