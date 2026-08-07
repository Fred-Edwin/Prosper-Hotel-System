"use client";

/**
 * Staff frame — "Launcher".
 *
 * The argument, and it is the one I would bet on: **a cashier is not
 * navigating.** She is on the till for six hours, and once at the end of the
 * shift she hands over. Persistent navigation is furniture for a journey nobody
 * takes — and worse, it permanently occupies the bottom 60px of the screen,
 * which is exactly where the thumb is and exactly where "Complete sale" and
 * "Record handover" need to live.
 *
 * So there is no persistent nav. A task is entered from a **home screen** — big
 * targets, one per thing she does, with what is waiting shown on the tile
 * itself — and inside a task the whole screen belongs to the task. Leaving is a
 * back arrow in the header, which is the one gesture every phone user has.
 *
 * The trade this makes is deliberate: switching between two tasks costs a trip
 * through home. That is the right trade when the honest task-switch rate is
 * about twice a shift, and it buys back the bottom of the screen for the action
 * that actually matters.
 *
 * The home screen also gets to say what needs doing, which a tab bar cannot:
 * "hand over — your shift ends in 40 minutes" is a sentence, not a badge.
 *
 * Where it is weak: a store manager genuinely does switch — receive a
 * delivery, issue to the kitchen, sell, count — and for them the trip through
 * home is a real cost. Six links is where this frame is least comfortable.
 */

import { staffNav, type StaffRole } from "./staff-nav";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function StaffShellHome({
  staffName,
  locationName,
  active,
  title,
  onHome,
  children,
}: {
  /** The signed-in staff member's display name. */
  staffName: string;
  /** The location they are signed in at. */
  locationName: string;
  active: string | null;
  title: string;
  onHome?: () => void;
  children: React.ReactNode;
}) {
  const inTask = active !== null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-2 py-2.5">
        {inTask ? (
          <>
            <button
              onClick={onHome}
              className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Back to home"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] leading-tight font-semibold">
                {title}
              </div>
              <div className="text-[11px] leading-tight text-muted-foreground capitalize">
                {locationName} · {staffName}
              </div>
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1 px-2">
            <div className="text-[15px] leading-tight font-semibold capitalize">
              {locationName}
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              {staffName}
            </div>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}

/**
 * The home screen. Large targets, and the one thing waiting stated as a
 * sentence rather than badged.
 */
export function StaffHome({
  role,
  handedOverToday,
  onOpen,
}: {
  role: StaffRole;
  /** Whether today's handover is already recorded. */
  handedOverToday: boolean;
  onOpen: (key: string) => void;
}) {
  const links = staffNav[role];
  const primary = links[0];
  const rest = links.slice(1);

  return (
    <div className="p-3">
      {/* What is waiting. A sentence, because a badge cannot say "why".
          Deliberately no figure: the count is blind, so the home screen must
          not leak what the till expects either. */}
      {!handedOverToday && (
        <button
          onClick={() => onOpen("handover")}
          className="mb-3 flex w-full items-center gap-3 rounded-lg border border-warning/40 bg-warning-subtle p-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">
              You haven&apos;t handed over today
            </div>
            <div className="text-[11px] text-muted-foreground">
              Count your cash and M-Pesa at the end of your shift
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* The thing she does all day, given the space that implies. */}
      <button
        onClick={() => onOpen(primary.key)}
        className="mb-2 flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors duration-100 active:bg-muted"
      >
        <primary.icon className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{primary.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {primary.hint}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="grid grid-cols-2 gap-2">
        {rest.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.key}
              onClick={() => onOpen(l.key)}
              className="flex min-h-[88px] flex-col items-start justify-between rounded-lg border bg-card p-3 text-left transition-colors duration-100 active:bg-muted"
            >
              <Icon className="size-5 text-muted-foreground" />
              <div>
                <div className="text-[13px] font-medium">{l.label}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">
                  {l.hint}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
