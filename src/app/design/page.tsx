import Link from "next/link";

/**
 * The design index, after the lock.
 *
 * Every admin destination and both shells, all built from the templates in
 * `src/components/patterns/`. The reasoning behind each choice is in
 * `docs/design.md`; the losing variants are on `design-variants-archive`.
 */

const admin = [
  {
    href: "/design/shell",
    name: "Dashboard",
    what: "Today's figures with their arithmetic, and what needs her",
  },
  {
    href: "/design/ledger",
    name: "Ledger",
    what: "Four sub-ledgers. Where every figure comes from",
  },
  {
    href: "/design/frame",
    name: "Stock",
    what: "What is on hand and what it is worth · carries all five states",
    states: true,
  },
  {
    href: "/design/money-out",
    name: "Money out",
    what: "Purchases, running costs, equipment, drawings · staff entries wait here",
    states: true,
  },
  {
    href: "/design/people",
    name: "People",
    what: "Staff and customers — who is owed, and who owes",
    states: true,
  },
  {
    href: "/design/catalogue",
    name: "Catalogue",
    what: "Products, ingredients, recipes, assets · the recipe builder",
  },
  {
    href: "/design/activity",
    name: "Activity",
    what: "Every change, who made it, when · the audit trail at volume",
    states: true,
  },
];

const staff = [
  {
    href: "/design/till",
    name: "Till",
    what: "The counter flow · switch between restaurant and canteen",
  },
  {
    href: "/design/staff",
    name: "Handover",
    what: "A blind count · switch between the three staff shells",
  },
];

export default function DesignIndex() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Design — settled</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every destination, built from the templates in{" "}
        <code className="text-xs">components/patterns</code>. The reasons are in{" "}
        <code className="text-xs">docs/design.md</code>.
      </p>

      <Section title="Admin" note="Laptop first, responsive. Lucy." items={admin} />
      <Section
        title="Staff"
        note="Phone, one-handed, mid-service."
        items={staff}
      />

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        Pages marked <em>states</em> carry a switcher for loading, error,
        permission-denied and first-use. Losing variants are on the{" "}
        <code>design-variants-archive</code> branch.
      </p>
    </main>
  );
}

function Section({
  title,
  note,
  items,
}: {
  title: string;
  note: string;
  items: { href: string; name: string; what: string; states?: boolean }[];
}) {
  return (
    <>
      <div className="mt-8 mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="space-y-2">
        {items.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-md border bg-card p-3 transition-colors duration-100 hover:bg-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">{s.name}</span>
              {s.states && (
                <span className="text-[10px] text-muted-foreground">states</span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{s.what}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
