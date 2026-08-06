import Link from "next/link";

const screens = [
  {
    href: "/design/till",
    name: "Till / new sale",
    shell: "Staff · phone",
    question: "Does the till handle three different users without slowing the cashier?",
    variants: "A one screen · B three modes · C toggle + payment lines",
  },
  {
    href: "/design/ledger",
    name: "Ledger",
    shell: "Admin · desktop",
    question: "Do six merged screens hold together as one page?",
    variants: "A six tabs · B one table · C by figure",
  },
  {
    href: "/design/dashboard",
    name: "Dashboard",
    shell: "Admin · responsive",
    question: "What does Lucy see first?",
    variants: "A stat row · B two questions · C exceptions first",
  },
];

export default function DesignIndex() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Design — round one</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Three destinations, three variants each. Arrow keys cycle variants.
      </p>

      <div className="mt-6 space-y-3">
        {screens.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-md border bg-card p-4 transition-colors duration-100 hover:bg-accent"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.shell}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{s.question}</p>
            <p className="mt-2 text-xs text-muted-foreground">{s.variants}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
