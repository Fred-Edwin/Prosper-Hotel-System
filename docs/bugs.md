# Bugs — Prosper Hotel

Intake log for `/fix`. Log a bug here as soon as it's found — what was
asked/reported, by whom, when — even before triage decides how it gets
fixed. Nothing gets fixed off a bug that only exists in conversation.

Format, one entry per bug:

```markdown
## BUG-<NN>: <short title>
**Severity:** critical | high | normal | low
**Discovered:** <how — client report, production error, manual testing>
**Status:** open | in-progress | fixed

### Description
What's broken.

### Repro steps
1. ...

### Expected vs actual
...
```

## BUG-01: Non-financial corrections don't retain the previous value
**Severity:** normal
**Discovered:** pre-handoff verification pass (proposal.md coverage audit),
2026-08-12
**Status:** open

### Description
proposal.md §8: "Non-financial corrections — a misspelled name or an
incorrect telephone number — are amended directly, with the previous
value retained." §9's Activity record also requires that "where a record
has been amended, the record shows that it was amended, by whom, and its
previous value."

`updateStaffMemberRecord`/`updateCustomerRecord`
(`src/modules/people/queries.ts`) currently overwrite `name`/`phone` in
place. There is no history table or previous-value column, and nothing
in `getActivity` (`src/modules/reporting/logic.ts`) can surface that a
name/phone was ever changed, let alone what it changed from.

### Repro steps
1. Edit a staff member's or customer's name or phone number.
2. Check the Activity record (reporting) for that person.

### Expected vs actual
Expected: the amendment appears in the activity trail, showing old and
new values and who made the change.
Actual: the record is silently overwritten; no trace of the previous
value exists anywhere.

### Notes
Needs a schema decision (a history/correction table, or previous-value
columns on `StaffMember`/`Customer`) — deliberately not fixed as part of
the pre-handoff verification pass since it's schema-level work, not a
same-shape fix to the three permission/reporting gaps found alongside
it. Triage via `/fix` when ready.
