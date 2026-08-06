"use client";

/**
 * A customer, on the detail template.
 *
 * The second proof that `DetailPage` generalises: it was settled on a staff
 * member, and a customer is a different record entirely — a balance that moves
 * rather than a rate that is set. The split still holds. What is *true* about
 * them on the left, what *happened* on the right.
 *
 * The balance is shown as an arithmetic rather than a figure, because it is not
 * a stored number: credit extended less repayments. That is the same rule the
 * dashboard and the pay figure follow, and it is why "taking a repayment
 * happens on the customer" works — the movement lands in the list beneath the
 * figure it changes.
 */

import { useState } from "react";
import { customers, customerDetail, money } from "@/lib/fixtures";
import {
  DetailPage,
  DetailCard,
  FactList,
  EditSheet,
} from "@/components/patterns/detail-page";
import { FormSection, Field } from "@/components/patterns/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function CustomerPage({ id }: { id: string }) {
  const [editing, setEditing] = useState(false);
  const customer = customers.find((c) => c.id === id)!;
  const detail = customerDetail[id];

  const credit =
    detail?.movements
      .filter((m) => m.kind === "credit")
      .reduce((s, m) => s + m.amount, 0) ?? 0;
  const repaid =
    detail?.movements
      .filter((m) => m.kind === "repayment")
      .reduce((s, m) => s + m.amount, 0) ?? 0;

  return (
    <>
      <DetailPage
        identity={
          <>
            <DetailCard
              title="Owes the business"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3" /> Edit
                </Button>
              }
              footnote="A balance is never edited directly. It is what credit less repayments comes to."
            >
              <div className="tabular text-3xl font-semibold">
                {money(customer.balance)}
              </div>
              <div className="mt-3 space-y-1 border-t pt-2 text-[13px]">
                <Line label="Credit extended" value={credit} />
                <Line label="Repaid" value={repaid} sign="−" />
              </div>
              {/* The page's one accent, beside the figure it settles. */}
              <Button size="sm" className="mt-4 h-8 w-full">
                Take a repayment
              </Button>
            </DetailCard>

            <DetailCard title="Details" flush>
              <div className="py-2">
                <FactList
                  facts={[
                    {
                      label: "Phone",
                      value: customer.phone ?? "—",
                      tabular: !!customer.phone,
                    },
                    {
                      label: "Customer since",
                      value: detail?.since ?? "—",
                      tabular: true,
                    },
                    {
                      label: "Oldest unpaid",
                      value: detail ? (
                        <span
                          className={detail.oldestDays > 60 ? "text-danger" : ""}
                        >
                          {detail.oldestDays} days
                        </span>
                      ) : (
                        "—"
                      ),
                      tabular: true,
                    },
                    {
                      label: "Status",
                      value:
                        customer.balance > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-warning/40 bg-warning-subtle font-normal text-warning"
                          >
                            Owing
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Settled
                          </Badge>
                        ),
                    },
                  ]}
                />
              </div>
            </DetailCard>
          </>
        }
        history={
          <DetailCard
            title="Credit and repayments"
            flush
            badge={
              <span className="tabular text-xs text-muted-foreground">
                {detail?.movements.length ?? 0} entries
              </span>
            }
          >
            {!detail || detail.movements.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Nothing recorded yet. Credit taken at the till will appear here.
              </p>
            ) : (
              <div className="divide-y">
                {detail.movements.map((m) => {
                  const out = m.kind === "credit";
                  return (
                    <div
                      key={`${m.date}-${m.description}`}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      {out ? (
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ArrowDownLeft className="size-4 shrink-0 text-success" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px]">{m.description}</div>
                        <div className="tabular text-[11px] text-muted-foreground">
                          {m.date} · {m.recordedBy}
                        </div>
                      </div>
                      <span
                        className={`tabular shrink-0 text-[13px] font-medium ${
                          out ? "" : "text-success"
                        }`}
                      >
                        {out ? "+" : "−"}
                        {money(m.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailCard>
        }
      />

      <EditSheet
        open={editing}
        onOpenChange={setEditing}
        title={`Edit ${customer.name}`}
        description="The balance cannot be changed here — it is what credit less repayments comes to."
      >
        <FormSection title="Identity">
          <Field label="Name">
            <Input defaultValue={customer.name} className="h-9" />
          </Field>
          <Field label="Phone" hint="Used to send a reminder about what is owed">
            <Input
              defaultValue={customer.phone ?? ""}
              placeholder="Not recorded"
              className="h-9"
            />
          </Field>
        </FormSection>

        <FormSection title="Balance">
          <Field
            label="Owes"
            lockedReason="Credit less repayments. Correct it by recording a repayment or a credit entry, so the change is attributable."
          >
            <Input
              defaultValue={customer.balance}
              disabled
              className="tabular h-9"
            />
          </Field>
        </FormSection>
      </EditSheet>
    </>
  );
}

function Line({
  label,
  value,
  sign,
}: {
  label: string;
  value: number;
  sign?: "−";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">
        {sign === "−" ? "−" : ""}
        {money(value)}
      </span>
    </div>
  );
}
