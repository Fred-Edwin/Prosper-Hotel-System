import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { DashboardR2A } from "@/components/design/dashboard/dashboard-r2a";
import { DashboardR2B } from "@/components/design/dashboard/dashboard-r2b";
import { DashboardR2C } from "@/components/design/dashboard/dashboard-r2c";
import { DashboardA } from "@/components/design/dashboard/dashboard-a";
import { DashboardB } from "@/components/design/dashboard/dashboard-b";
import { DashboardC } from "@/components/design/dashboard/dashboard-c";

/**
 * Round two leads. All three share the settled figure treatment and differ in
 * layout only. Round one stays reachable for comparison until lock.
 */
const variants: VariantDef[] = [
  { key: "R2A", name: "P&L column", note: "Profit read downward, cash beside" },
  { key: "R2B", name: "Headline row", note: "Breakdown under each figure" },
  { key: "R2C", name: "Waterfall + tabs", note: "Proportional bars, tabbed detail" },
  { key: "A", name: "R1 · Stat row", note: "For comparison" },
  { key: "B", name: "R1 · Two questions", note: "For comparison" },
  { key: "C", name: "R1 · Exceptions first", note: "For comparison" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "R2A";

  return (
    <Suspense>
      {key === "R2B" ? (
        <DashboardR2B />
      ) : key === "R2C" ? (
        <DashboardR2C />
      ) : key === "A" ? (
        <DashboardA />
      ) : key === "B" ? (
        <DashboardB />
      ) : key === "C" ? (
        <DashboardC />
      ) : (
        <DashboardR2A />
      )}
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
