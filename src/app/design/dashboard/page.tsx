import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { DashboardR3 } from "@/components/design/dashboard/dashboard-r3";
import { DashboardR2A } from "@/components/design/dashboard/dashboard-r2a";
import { DashboardR2B } from "@/components/design/dashboard/dashboard-r2b";
import { DashboardR2C } from "@/components/design/dashboard/dashboard-r2c";

/**
 * Round three leads: the hybrid. Round two stays reachable for comparison
 * until lock; round one is retired, having been superseded twice.
 */
const variants: VariantDef[] = [
  { key: "R3", name: "Hybrid", note: "C's waterfall · B's cash · charts" },
  { key: "R2A", name: "R2 · P&L column", note: "For comparison" },
  { key: "R2B", name: "R2 · Headline row", note: "For comparison" },
  { key: "R2C", name: "R2 · Waterfall + tabs", note: "For comparison" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "R3";

  return (
    <Suspense>
      {key === "R2A" ? (
        <DashboardR2A />
      ) : key === "R2B" ? (
        <DashboardR2B />
      ) : key === "R2C" ? (
        <DashboardR2C />
      ) : (
        <DashboardR3 />
      )}
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
