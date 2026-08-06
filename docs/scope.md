# Scope — Prosper Hotel

## The v1 destination

Prosper Hotel's two locations run their daily trade in one system: stock received, issued to
the kitchen, transferred between locations, counted and sold; sales taken in cash, M-Pesa and
credit; each day closed and handed over with discrepancies visible per person; and the owner
able to see profit, cash position, debtors and stock value across both locations — with every
entry attributable to the person who made it, and the full history of any item on any day
readable exactly as it happened.

The bar it must clear: **anything the Excel sheets do today, it does at least as well.**

---

## Out of scope for v1

This list is worth more than the one above. It is what stops creep.

**AI query layer.** An assistant the owner could ask "am I making money?" in plain language,
reading the historical data directly. A genuinely good fit for this client — she is absent
during trading hours, non-technical, and already phrases every need as a question rather than
a report. Deferred because it is a layer *on top of* the data and has nothing to read until
stock, sales and cash are real; and because an assistant answering questions about money from
a half-built schema is worse than no assistant. **Nothing in v1 needs to change to allow it**
— the full attributed movement history it would depend on is already the design. When built,
it must read through the module interfaces rather than querying the database directly, so
that location scoping applies to it automatically.

**Offline sales.** Rejected on evidence: connectivity at both locations is reliable in
practice. Sales are append-only and therefore the safe first candidate if that changes.

**Asset depreciation.** Assets are recorded and kept out of profit, but their cost is not
spread over their useful life. Real accounting, and an addition rather than a rework if the
owner later wants it.

**Supplier accounts.** Suppliers are paid on delivery. No supplier credit, no payables, no
supplier statements.

**Automatic M-Pesa reconciliation.** No paybill integration. M-Pesa is recorded by hand as a
payment line.

**Payroll beyond days worked.** Pay is days worked multiplied by a daily rate. No tax, no
NSSF, no NHIF, no advances or deductions.

**Anything customer-facing.** No online ordering, no customer portal, no notifications to
customers. Delivery orders are recorded by staff, as they are today.

**A third location.** The design is location-scoped throughout and would accommodate one, but
nothing is built or tested for it.

---

## Still to establish

Carried forward from discovery. None blocks v1, but each will need an answer before the part
of the system it touches is built.

- How the daily quantity sent to the canteen is decided.
- Which products have a known, reliable yield, and what those yields are.
- Whether selling prices change as often as purchase costs do.
- Whether cashiers hold a float overnight, or hand over everything.
- How printing is priced — per page, per job, or per document type.
- How far back the audit trail needs to be readable.
