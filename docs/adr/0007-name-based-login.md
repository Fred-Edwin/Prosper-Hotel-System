# 0007 — Name, not phone number, as the login identifier

**Date:** 2026-08-07
**Status:** Accepted

## Context

The original decision (Foundation session, `docs/architecture.md`) was phone number plus a
four-digit PIN — reasoning that staff use their own phones and log in mid-service, so an
email-and-password flow is friction that gets worked around.

In practice, a phone number is one more thing a staff member has to recall or type correctly
under pressure with customers waiting, where their own name is not. Typos in an eleven-digit
number are also a more likely failure mode at the keyboard than a typo in a short name.

## Decision

Login is a **name** and a four-digit PIN. `StaffMember.name` is unique, enforced at the
schema level (migration `20260807105226_staff_name_unique`), and `login()` looks staff up by
name rather than phone.

`StaffMember.phone` is unchanged in the schema — still present, still unique — since it is
real data the owner may want for other reasons (contacting staff, delivery coordination). It
simply stops being the login identifier.

## Alternatives considered

**Keep phone number.** Rejected on the reasoning above — it is worse for the actual person
typing it in, which is the whole justification the original phone-based decision rested on.
Keeping it would have preserved a decision past the point its own reasoning still applied.

**Allow login by either name or phone.** Rejected for now as unnecessary complexity — one
identifier is simpler to reason about, and nothing in discovery or the proposal suggested
staff need a fallback identifier. Worth revisiting only if a real name-collision or
can't-remember-your-own-name case actually occurs.

## Consequences

**Good.** Faster, more error-tolerant login for staff, which is the entire point of a
PIN-based scheme in the first place — the friction being removed here is the same friction
`docs/architecture.md`'s original login decision already existed to eliminate.

**Bad, and accepted.** `StaffMember.name` must now be unique across all staff, including
across the two locations. Two staff members who happen to share a first and last name need a
distinguishing name — a middle name, a surname variant, a nickname — assigned by the owner
when the second one is added. Not automated; the owner is expected to notice and handle this
the same way she would already handle two people sharing a name in conversation.

**Reversible.** The schema still carries `phone`. Reverting to phone-based login is a
`login()`/`queries.ts` change, not a schema migration, if this decision needs revisiting.
