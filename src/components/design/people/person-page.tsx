"use client";

/**
 * A person, built from the templates rather than from a variant.
 *
 * This is the test that round C actually produced templates: the Aside layout
 * that won is now `DetailPage` + `DetailCard` + `FactList` + `EditSheet`, and
 * this page composes them without inventing anything. If it had needed a new
 * pattern, the templates would be incomplete.
 *
 * Nothing here decides layout. It decides what goes in which column, which is
 * the ticket's job, not the design's.
 */

import { useState } from "react";
import { money, roleLabel } from "@/lib/fixtures";
import {
  DetailPage,
  DetailCard,
  FactList,
  EditSheet,
} from "@/components/patterns/detail-page";
import { LoadingDetail, PermissionDenied } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  person,
  detail,
  daysWorked,
  netOwed,
  openShortfalls,
  PayArithmetic,
  DaysTable,
  Shortfalls,
  PersonForm,
} from "./shared";
import { Pencil, Phone } from "lucide-react";

export type PersonState = "ready" | "loading" | "denied";

export function PersonPage({ state = "ready" }: { state?: PersonState }) {
  const [editing, setEditing] = useState(false);

  if (state === "loading") return <LoadingDetail />;

  if (state === "denied")
    return (
      <PermissionDenied
        title="Pay details are owner-only"
        body="You can see who works here and which days they worked. What each person is paid is restricted to Lucy — ask her if you need it."
      />
    );

  return (
    <>
      <DetailPage
        identity={
          <>
            <DetailCard
              title="Owed to them"
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
              footnote={`Last paid ${detail.lastPaid ?? "never"}. Paying records a cash movement and clears the balance.`}
            >
              {/* The figure, then its arithmetic directly beneath it. */}
              <div className="tabular text-3xl font-semibold">
                {money(netOwed)}
              </div>
              <div className="mt-3 border-t pt-2">
                <PayArithmetic compact />
              </div>
              {/* The page's one accent element, beside the amount it settles. */}
              <Button size="sm" className="mt-4 h-8 w-full">
                Pay {person.name}
              </Button>
            </DetailCard>

            <DetailCard title="Details" flush>
              <div className="px-0 py-2">
                <FactList
                  facts={[
                    { label: "Role", value: roleLabel[person.role] },
                    { label: "Location", value: person.location, capitalize: true },
                    {
                      label: "Daily rate",
                      value: money(person.dailyRate),
                      tabular: true,
                    },
                    {
                      label: "Phone",
                      value: detail.phone ?? "—",
                      tabular: !!detail.phone,
                    },
                    { label: "Started", value: detail.startedOn, tabular: true },
                    {
                      label: "Status",
                      value: (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success-subtle font-normal text-success"
                        >
                          Working here
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
          <>
            <DetailCard
              title="Handovers"
              flush
              badge={
                openShortfalls.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-danger/30 bg-danger-subtle text-danger"
                  >
                    {openShortfalls.length} unexplained
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    All agreed
                  </Badge>
                )
              }
            >
              <Shortfalls />
            </DetailCard>

            <DetailCard
              title="Days worked"
              flush
              badge={
                <span className="tabular text-xs text-muted-foreground">
                  {daysWorked} of {detail.daysWorked.length}
                </span>
              }
            >
              <DaysTable />
            </DetailCard>
          </>
        }
      />

      <EditSheet
        open={editing}
        onOpenChange={setEditing}
        title={`Edit ${person.name}`}
        description="Changes apply from today. Past days keep the rate they were worked at."
      >
        <PersonForm />
      </EditSheet>
    </>
  );
}
