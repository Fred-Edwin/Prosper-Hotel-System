"use client";

/**
 * Pieces shared by the three People detail variants, so they disagree about
 * *structure* only and cannot accidentally differ in content.
 *
 * Everything here is content, not layout: the arithmetic of what a person is
 * owed, the days-worked table, the shortfall list, the edit form's fields. Each
 * variant decides where these go and how they are reached.
 */

import {
  staff,
  staffDetail,
  roleLabel,
  money,
  type Staff,
  type StaffDetail,
} from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, TriangleAlert, X } from "lucide-react";

export const person = staff.find((s) => s.id === "s3")! as Staff;
export const detail = staffDetail.s3 as StaffDetail;

export const daysWorked = detail.daysWorked.filter((d) => d.worked).length;
export const earned = daysWorked * person.dailyRate;
export const netOwed = detail.owedToStaff - detail.advances;
export const openShortfalls = detail.shortfalls.filter((s) => !s.resolved);

/**
 * What the business owes this person, as an arithmetic rather than a figure.
 * Every figure in this app shows its composition; pay is no exception, and it
 * is the number most likely to be disputed out loud.
 */
export function PayArithmetic({ compact }: { compact?: boolean }) {
  const rows: { label: string; value: number; sign?: "−"; strong?: boolean }[] = [
    { label: `${daysWorked} days × ${money(person.dailyRate)}`, value: earned },
    { label: "Advances taken", value: detail.advances, sign: "−" },
  ];

  return (
    <div className={compact ? "text-[13px]" : "text-sm"}>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-3 py-1"
        >
          <span className="text-muted-foreground">{r.label}</span>
          <span className="tabular whitespace-nowrap">
            {r.sign === "−" ? "−" : ""}
            {money(r.value)}
          </span>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2 font-semibold">
        <span>Owed to {person.name}</span>
        <span className="tabular whitespace-nowrap">{money(netOwed)}</span>
      </div>
      {openShortfalls.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Shortfalls are not deducted here. A till discrepancy is a question to
          settle, not an automatic wage deduction.
        </p>
      )}
    </div>
  );
}

export function DaysTable() {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
          <th className="px-3 py-2 text-left font-medium">Date</th>
          <th className="px-2 py-2 text-left font-medium">Location</th>
          <th className="px-2 py-2 text-left font-medium">Worked</th>
          <th className="px-3 py-2 text-right font-medium">Earned</th>
        </tr>
      </thead>
      <tbody>
        {detail.daysWorked.map((d) => (
          <tr key={d.date} className="border-b last:border-0 hover:bg-muted/40">
            <td className="tabular px-3 py-2">{d.date}</td>
            <td className="px-2 py-2 text-muted-foreground capitalize">
              {d.location}
            </td>
            <td className="px-2 py-2">
              {d.worked ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Check className="size-3.5 text-success" /> Yes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <X className="size-3.5" /> {d.note ?? "No"}
                </span>
              )}
            </td>
            <td className="tabular px-3 py-2 text-right">
              {d.worked ? (
                money(person.dailyRate)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
        <tr className="bg-muted/40 font-medium">
          <td className="px-3 py-2" colSpan={3}>
            {daysWorked} days this period
          </td>
          <td className="tabular px-3 py-2 text-right">{money(earned)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Shortfalls() {
  if (openShortfalls.length === 0)
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
        <Check className="size-4 text-success" />
        Every handover has agreed. Nothing outstanding.
      </div>
    );

  return (
    <div className="divide-y">
      {openShortfalls.map((s) => (
        <div key={s.date} className="flex items-center gap-3 px-4 py-2.5">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">
              Cash short {money(s.amount)} on {s.date}
            </div>
            <div className="text-xs text-muted-foreground">
              Handed over less than the till expected. Not yet explained.
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs">
            Look into it
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * The edit form. Single column, labels above, sections once past ~8 fields.
 *
 * `disabledReason` renders the owner-gated fields as disabled with a stated
 * reason rather than hiding them — a manager should be able to see that a pay
 * rate exists and that it is not theirs to change. A hidden control teaches
 * nothing; a disabled one with a reason teaches who to ask.
 */
export function PersonForm({
  disabledReason,
}: {
  disabledReason?: string;
}) {
  return (
    <div className="space-y-5">
      <Section title="Identity">
        <Field label="Name">
          <Input defaultValue={person.name} className="h-9" />
        </Field>
        <Field label="Phone" hint="Used for M-Pesa payments">
          <Input
            defaultValue={detail.phone ?? ""}
            placeholder="Not recorded"
            className="h-9"
          />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Role">
          <Select defaultValue={person.role}>
            <SelectTrigger className="h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(roleLabel) as Staff["role"][]).map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location">
          <Select defaultValue={person.location}>
            <SelectTrigger className="h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="canteen">Canteen</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Daily rate"
          hint={disabledReason ?? "Applies from today; past days keep the rate they were worked at"}
          disabled={!!disabledReason}
        >
          <Input
            defaultValue={person.dailyRate}
            inputMode="numeric"
            disabled={!!disabledReason}
            className="tabular h-9"
          />
        </Field>
      </Section>

      <Section title="Status">
        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-medium">Currently working here</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Turning this off stops them appearing in handovers and rosters.
              Their history is kept.
            </p>
          </div>
          <Switch defaultChecked={person.active} />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  disabled,
  children,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={disabled ? "opacity-70" : ""}>
      <Label className="mb-1 text-[13px]">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RoleBadge() {
  return (
    <Badge variant="outline" className="font-normal">
      {roleLabel[person.role]}
    </Badge>
  );
}
