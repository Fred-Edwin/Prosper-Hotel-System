import { Suspense } from "react";
import { VariantSwitcher, type VariantDef } from "@/components/design/variant-switcher";
import { DashboardA } from "@/components/design/dashboard/dashboard-a";
import { DashboardB } from "@/components/design/dashboard/dashboard-b";
import { DashboardC } from "@/components/design/dashboard/dashboard-c";

const variants: VariantDef[] = [
  { key: "A", name: "Stat row", note: "Seven tiles, then tables" },
  { key: "B", name: "Two questions", note: "Profit and cash, equal weight" },
  { key: "C", name: "Exceptions first", note: "What needs her, then figures" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const key = variant?.toUpperCase() ?? "A";

  return (
    <Suspense>
      {key === "B" ? <DashboardB /> : key === "C" ? <DashboardC /> : <DashboardA />}
      <VariantSwitcher variants={variants} />
    </Suspense>
  );
}
