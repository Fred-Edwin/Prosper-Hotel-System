"use client";

/**
 * People — the destination.
 *
 * Two kinds of person since round E moved customers here from Catalogue: staff
 * the business owes, and customers who owe it. Tabs on the list; the same
 * detail template for both records, which is the proof that `DetailPage`
 * generalises beyond the staff member it was settled on.
 *
 * `?state=` keeps the detail page's loading and permission-denied treatments
 * reachable until lock.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "@/components/design/shell/admin-shell";
import { PeopleList } from "./list";
import { PersonPage, type PersonState } from "./person-page";
import { CustomerPage } from "./customer-page";
import { staff, customers, roleLabel, customerDetail } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserMinus, Plus } from "lucide-react";

const states: PersonState[] = ["ready", "loading", "denied"];

export function PeopleRound() {
  const params = useSearchParams();
  const state = (params.get("state") as PersonState) ?? "ready";
  const [openId, setOpenId] = useState<string | null>(null);

  const person = staff.find((s) => s.id === openId) ?? null;
  const customer = customers.find((c) => c.id === openId) ?? null;
  const detail = person ?? customer;

  return (
    <>
      <AdminShell
        active="people"
        trail={detail ? [{ label: "People", href: "#" }] : undefined}
        title={detail ? detail.name : "People"}
        subtitle={
          person
            ? `${roleLabel[person.role]} · ${person.location} · started ${customerDetail[person.id]?.since ?? "2 June 2025"}`
            : customer
              ? `Customer since ${customerDetail[customer.id]?.since ?? "—"}`
              : "Who is owed, and who owes"
        }
        actions={
          detail ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {person ? (
                    <>
                      <DropdownMenuItem>Give an advance</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">
                        <UserMinus className="size-3.5" />
                        Mark as no longer working here
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem>Record credit taken</DropdownMenuItem>
                      <DropdownMenuItem>Send a reminder</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setOpenId(null)}
              >
                All people
              </Button>
            </>
          ) : (
            <Button size="sm" className="h-8">
              <Plus className="size-3.5" /> Add someone
            </Button>
          )
        }
      >
        {person ? (
          <PersonPage state={state} />
        ) : customer ? (
          <CustomerPage id={customer.id} />
        ) : (
          <PeopleList onOpen={setOpenId} />
        )}
      </AdminShell>

      <AccentSwitcher />
      {detail && <StateSwitcher current={state} />}
    </>
  );
}

function StateSwitcher({ current }: { current: PersonState }) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 48,
        right: 12,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        color: "#fafafa",
      }}
    >
      <span style={{ padding: "0 4px 0 6px", opacity: 0.6 }}>state</span>
      {states.map((s) => (
        <a
          key={s}
          href={`?state=${s}`}
          style={{
            padding: "3px 7px",
            borderRadius: 999,
            textDecoration: "none",
            background: current === s ? "#fafafa" : "#3f3f46",
            color: current === s ? "#18181b" : "#fafafa",
          }}
        >
          {s}
        </a>
      ))}
    </div>
  );
}
