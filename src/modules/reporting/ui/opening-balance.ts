/**
 * 2026-08-14's catalog/stock reload landed as `corrected` stock-count
 * corrections (see `docs/opening balance/handover-exclude-opening-load-
 * from-profit.md`), not real trading — opening=0, bought=0 makes that
 * day's cost-of-goods-sold formula (formulas.md §6) produce a large
 * negative number and a nonsense "net profit". Real trading starts
 * 2026-08-15. This only changes what day the Dashboard/Ledger *default*
 * to — 2026-08-14 is still reachable by picking it manually, and its
 * stock movements still feed 2026-08-15's opening balance per formulas.md
 * §1. Delete this file (and its two call sites) once it stops mattering,
 * e.g. once "This month"/"This year" views naturally dilute the one-day
 * artifact.
 */
const OPENING_BALANCE_LOAD_DAY = "2026-08-14";

function isoDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True while "today" is still the opening-balance load day — real trading
 * hasn't started yet, so there's no earlier or later day to default to. */
export function isOpeningBalanceLoadDay(now: Date): boolean {
  return isoDateLocal(now) === OPENING_BALANCE_LOAD_DAY;
}
