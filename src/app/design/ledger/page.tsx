import { LedgerR3 } from "@/components/design/ledger/ledger-r3";
import { AccentSwitcher } from "@/components/design/accent-switcher";

/**
 * Settled: the tabbed layout, four sub-ledgers, waterfall stats bar.
 * The sectioned and master–detail alternatives have been removed.
 */
export default function LedgerPage() {
  return (
    <>
      <LedgerR3 />
      <AccentSwitcher />
    </>
  );
}
