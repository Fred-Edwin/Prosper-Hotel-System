import { Suspense } from "react";
import {
  VariantSwitcher,
  type VariantDef,
} from "@/components/design/variant-switcher";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { TillR2 } from "@/components/design/till/till-r2";

/**
 * The till, settled after round two. The round-one variants are gone — they
 * live on `design-variants-archive` if the reasoning behind the combination
 * ever needs re-reading.
 *
 * The switcher stays for now, carrying the two locations: the same screen
 * serves Sarah at the restaurant and Anne at the canteen, and the difference
 * between them is worth being able to flip between.
 */
const variants: VariantDef[] = [
  { key: "R2", name: "Restaurant", note: "Sarah · the counter flow" },
  { key: "R2C", name: "Canteen", note: "Anne · same screen, her location" },
];

export default async function TillPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "R2";

  return (
    <Suspense>
      <div className="mx-auto max-w-md border-x">
        {key === "R2C" ? (
          <TillR2 location="canteen" staffName="Anne" />
        ) : (
          <TillR2 />
        )}
      </div>
      <VariantSwitcher variants={variants} />
      <AccentSwitcher />
    </Suspense>
  );
}
