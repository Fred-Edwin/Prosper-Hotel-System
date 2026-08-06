import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import {
  LedgerR2A,
  LedgerR2B,
  LedgerR2C,
} from "@/components/design/ledger/ledger-r2";
import { LedgerA } from "@/components/design/ledger/ledger-a";
import { LedgerB } from "@/components/design/ledger/ledger-b";
import { LedgerC } from "@/components/design/ledger/ledger-c";

/**
 * Round two leads: four tables — product movements, store movements, non-sales
 * consumption, cash movements — over three layouts. Round one stays reachable
 * for comparison until lock.
 */
const variants: VariantDef[] = [
  { key: "R2A", name: "Tabbed", note: "One table at a time" },
  { key: "R2B", name: "Sectioned", note: "All four, sticky sub-nav" },
  { key: "R2C", name: "Master–detail", note: "Left rail, stats in the rail" },
  { key: "A", name: "R1 · Six tabs", note: "For comparison" },
  { key: "B", name: "R1 · One table", note: "For comparison" },
  { key: "C", name: "R1 · By figure", note: "For comparison" },
];

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "R2A";

  return (
    <Suspense>
      {key === "R2B" ? (
        <LedgerR2B />
      ) : key === "R2C" ? (
        <LedgerR2C />
      ) : key === "A" ? (
        <LedgerA />
      ) : key === "B" ? (
        <LedgerB />
      ) : key === "C" ? (
        <LedgerC />
      ) : (
        <LedgerR2A />
      )}
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
