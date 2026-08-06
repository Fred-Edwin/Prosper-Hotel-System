"use client";

/**
 * The staff shell — Launcher — with the handover inside it.
 *
 * Settled in round D. The tab-bar and drawer frames are gone: the tab bar
 * fought the primary action for the bottom of the screen and could not hold
 * Janiffer's six links, and the drawer assumed a till underneath that Anne does
 * not have. The launcher degrades across all three staff shells rather than
 * failing on one.
 *
 * The handover is now a **blind count**, at the client's request. That is a
 * change to the control rather than a change to the layout, and it changes the
 * screen's job: it can no longer show a disagreement, so it has to make
 * counting careful instead. Hence two steps — count, then confirm the figures
 * echoed back — and no expected figure anywhere.
 *
 * `?role=` switches between the three staff shells, 3 / 6 / 5 links.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { StaffShellHome, StaffHome } from "./shell-home";
import {
  useHandover,
  MethodBlock,
  NoteBlock,
  ConfirmBlock,
} from "./handover-body";
import { type StaffRole } from "./nav";
import { Button } from "@/components/ui/button";

const roles: StaffRole[] = ["cashier", "store-manager", "attendant"];

function Handover() {
  const h = useHandover();

  if (h.confirming)
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex-1">
          <ConfirmBlock
            cashN={h.cashN}
            mpesaN={h.mpesaN}
            onBack={() => h.setConfirming(false)}
          />
        </div>
        <div className="sticky bottom-0 border-t bg-card px-4 py-3">
          <Button className="h-12 w-full text-[15px]">
            Hand over {h.cashN + h.mpesaN > 0 ? "now" : ""}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-2.5 p-3">
        <p className="text-[13px] text-muted-foreground">
          Count what you are handing over. Cash and M-Pesa are counted
          separately.
        </p>

        <MethodBlock
          label="Cash"
          note="Notes and coins in the drawer"
          value={h.cash}
          onChange={h.setCash}
        />

        <MethodBlock
          label="M-Pesa"
          note="Check against the paybill messages"
          value={h.mpesa}
          onChange={h.setMpesa}
        />

        <NoteBlock value={h.note} onChange={h.setNote} />
      </div>

      {/* The action owns the bottom edge — nothing competes with it, which is
          the whole reason the launcher beat the tab bar. */}
      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button
          className="h-12 w-full text-[15px]"
          disabled={!h.canSubmit}
          onClick={() => h.setConfirming(true)}
        >
          Check what I&apos;ve counted
        </Button>
        {!h.counted && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Enter both amounts, even if one is nothing
          </p>
        )}
      </div>
    </div>
  );
}

export function StaffRound() {
  const params = useSearchParams();
  const role = (params.get("role") as StaffRole) ?? "cashier";
  const [task, setTask] = useState<string | null>("handover");

  return (
    <>
      <StaffShellHome
        role={role}
        active={task}
        title="Handover"
        onHome={() => setTask(null)}
      >
        {task === null ? (
          <StaffHome role={role} onOpen={setTask} />
        ) : (
          <Handover />
        )}
      </StaffShellHome>

      <AccentSwitcher />
      <RoleSwitcher current={role} />
    </>
  );
}

/** The three staff shells — 3, 6 and 5 links. The frame must survive all three. */
function RoleSwitcher({ current }: { current: StaffRole }) {
  if (process.env.NODE_ENV === "production") return null;

  const label: Record<StaffRole, string> = {
    cashier: "Sarah · 3",
    "store-manager": "Janiffer · 6",
    attendant: "Anne · 5",
  };

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
      {roles.map((r) => (
        <a
          key={r}
          href={`?role=${r}`}
          style={{
            padding: "3px 7px",
            borderRadius: 999,
            textDecoration: "none",
            background: current === r ? "#fafafa" : "#3f3f46",
            color: current === r ? "#18181b" : "#fafafa",
          }}
        >
          {label[r]}
        </a>
      ))}
    </div>
  );
}
