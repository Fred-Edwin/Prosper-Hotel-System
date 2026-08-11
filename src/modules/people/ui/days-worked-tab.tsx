"use client";

/**
 * Days worked tab — pick a staff member, mark days worked, read the
 * computed pay for the current month and pay it out. Ticket 35.
 *
 * Reuses DetailPage/DetailCard/FactList (patterns/detail-page.tsx) rather
 * than inventing a new shape — the pattern's own doc comment names this
 * exact case ("a staff member has ... days worked and handovers right").
 * No Pay-button-with-advances/shortfalls composition from the design
 * reference — that page covers a broader, not-yet-scoped People redesign;
 * this tab only builds what ticket 35 asks for.
 */

import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Circle } from "lucide-react";
import { DetailPage, DetailCard, FactList } from "@/components/patterns/detail-page";
import { EmptyFirstUse, ErrorState, LoadingDetail } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/shared/money";
import type { StaffMember } from "../schema";

export type DaysWorkedEntry = { id: string; date: string; paidAs: string | null };
export type PayForStaff = {
  daysWorked: number;
  dailyRateMinor: number;
  payMinor: number;
  unpaidDaysWorked: number;
  unpaidMinor: number;
};

export type DaysWorkedState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; daysWorked: DaysWorkedEntry[]; pay: PayForStaff };

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DaysWorkedTab({
  staff,
  onFetch,
  onRecord,
  onPay,
}: {
  staff: StaffMember[];
  onFetch: (staffMemberId: string) => Promise<DaysWorkedState>;
  onRecord: (staffMemberId: string, date: string) => Promise<{ ok: boolean }>;
  onPay: (staffMemberId: string) => Promise<{ ok: boolean }>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeStaff = staff.filter((s) => s.active);

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="h-9 w-full text-[13px]">
            <SelectValue placeholder="Choose a staff member" />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id} disabled={!s.active}>
                {s.name}
                {!s.active ? " (inactive)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedId ? (
        <EmptyFirstUse
          icon={<CalendarCheck className="size-4" />}
          title="Choose a staff member"
          body={
            activeStaff.length === 0
              ? "No active staff yet — add one on the Staff tab first."
              : "Pick who you're recording days worked for."
          }
        />
      ) : (
        <StaffDaysWorked
          key={selectedId}
          staffMember={staff.find((s) => s.id === selectedId)!}
          onFetch={() => onFetch(selectedId)}
          onRecord={(date) => onRecord(selectedId, date)}
          onPay={() => onPay(selectedId)}
        />
      )}
    </div>
  );
}

function StaffDaysWorked({
  staffMember,
  onFetch,
  onRecord,
  onPay,
}: {
  staffMember: StaffMember;
  onFetch: () => Promise<DaysWorkedState>;
  onRecord: (date: string) => Promise<{ ok: boolean }>;
  onPay: () => Promise<{ ok: boolean }>;
}) {
  const [state, setState] = useState<DaysWorkedState>({ status: "loading" });
  const [date, setDate] = useState(todayInputValue());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setState(await onFetch());
  }

  useEffect(() => {
    let cancelled = false;
    onFetch().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffMember.id]);

  if (state.status === "loading") return <LoadingDetail />;
  if (state.status === "error") return <ErrorState what="days worked" onRetry={refresh} />;

  const { daysWorked, pay } = state;

  return (
    <DetailPage
      identity={
        <>
          <DetailCard
            title="Pay this month"
            footnote={
              pay.unpaidMinor > 0
                ? undefined
                : "Nothing owed for this month right now."
            }
          >
            <div className="tabular text-3xl font-semibold">{money(pay.payMinor)}</div>
            <div className="mt-3 border-t pt-2 text-[13px]">
              <div className="flex items-baseline justify-between gap-3 py-1">
                <span className="text-muted-foreground">
                  {pay.daysWorked} days × {money(pay.dailyRateMinor)}
                </span>
                <span className="tabular whitespace-nowrap">{money(pay.payMinor)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2 font-semibold">
                <span>Unpaid</span>
                <span className="tabular whitespace-nowrap">{money(pay.unpaidMinor)}</span>
              </div>
            </div>
            {pay.unpaidMinor > 0 && (
              <Button
                size="sm"
                className="mt-4 h-8 w-full"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await onPay();
                  setSaving(false);
                  await refresh();
                }}
              >
                {saving ? "Recording…" : `Mark ${money(pay.unpaidMinor)} as paid`}
              </Button>
            )}
          </DetailCard>

          <DetailCard title="Details" flush>
            <div className="px-0 py-2">
              <FactList
                facts={[
                  { label: "Daily rate", value: money(staffMember.dailyRateMinor), tabular: true },
                ]}
              />
            </div>
          </DetailCard>
        </>
      }
      history={
        <DetailCard
          title="Days worked"
          badge={
            <span className="tabular text-xs text-muted-foreground">
              {daysWorked.length} this month
            </span>
          }
        >
          <div className="mb-3 flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto"
            />
            <Button
              size="sm"
              className="h-9"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onRecord(date);
                setSaving(false);
                await refresh();
              }}
            >
              Mark worked
            </Button>
          </div>

          {daysWorked.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No days recorded yet this month.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {daysWorked.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="tabular">{new Date(d.date).toLocaleDateString()}</span>
                  {d.paidAs ? (
                    <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                      <CheckCircle2 className="size-3" /> Paid
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Circle className="size-3" /> Unpaid
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>
      }
    />
  );
}
