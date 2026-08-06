import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { LedgerA } from "@/components/design/ledger/ledger-a";
import { LedgerB } from "@/components/design/ledger/ledger-b";
import { LedgerC } from "@/components/design/ledger/ledger-c";

const variants: VariantDef[] = [
  { key: "A", name: "Six tabs", note: "One tab per former screen" },
  { key: "B", name: "One table", note: "Reason chips filter a single table" },
  { key: "C", name: "By figure", note: "Arithmetic strip, sidebar sections" },
];

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "A";

  return (
    <Suspense>
      {key === "B" ? <LedgerB /> : key === "C" ? <LedgerC /> : <LedgerA />}
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
