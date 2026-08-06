import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { TillA } from "@/components/design/till/till-a";
import { TillB } from "@/components/design/till/till-b";
import { TillC } from "@/components/design/till/till-c";

const variants: VariantDef[] = [
  { key: "A", name: "One screen", note: "No modes. Credit is a payment method" },
  { key: "B", name: "Three modes", note: "Counter / Delivery / Credit" },
  { key: "C", name: "Toggle + lines", note: "Fulfilment toggle, payment is a list" },
];

export default async function TillPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "A";

  return (
    <Suspense>
      <div className="mx-auto max-w-md border-x">
        {key === "B" ? <TillB /> : key === "C" ? <TillC /> : <TillA />}
      </div>
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
