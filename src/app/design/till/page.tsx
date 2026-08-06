import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { TillR2 } from "@/components/design/till/till-r2";
import { TillA } from "@/components/design/till/till-a";
import { TillB } from "@/components/design/till/till-b";
import { TillC } from "@/components/design/till/till-c";

/**
 * Round two leads. Round one stays reachable so the combination can be
 * compared against what it came from — deleted at lock along with the switcher.
 */
const variants: VariantDef[] = [
  { key: "R2", name: "Round two", note: "A's grid · B's modes · C's payments" },
  { key: "R2C", name: "Round two — canteen", note: "Same screen, Anne's location" },
  { key: "A", name: "R1 · One screen", note: "For comparison" },
  { key: "B", name: "R1 · Three modes", note: "For comparison" },
  { key: "C", name: "R1 · Toggle + lines", note: "For comparison" },
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
        {key === "A" ? (
          <TillA />
        ) : key === "B" ? (
          <TillB />
        ) : key === "C" ? (
          <TillC />
        ) : key === "R2C" ? (
          <TillR2 location="canteen" staffName="Anne" />
        ) : (
          <TillR2 />
        )}
      </div>
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
