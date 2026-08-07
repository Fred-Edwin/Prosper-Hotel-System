"use client";

/**
 * The admin sidebar, rebuilt after round A.
 *
 * Edwin chose Rail, then asked for four things: a distinct ground that
 * contrasts with the page, the collapse moved off the bottom edge, the collapse
 * kept, and suggestions for making it more interesting. Five changes:
 *
 *   **A dark ground.** The sidebar is the only surface on every admin screen,
 *   which makes it the cheapest place to give the software an identity — and
 *   the only place a strong colour can sit without spending the page's
 *   one-accent budget. Three grounds are live on `data-sidebar-tone`; every
 *   foreground was contrast-checked against all three rather than eyeballed,
 *   worst case 6.87:1 for muted labels.
 *
 *   **The collapse moved to the header row**, as a hairline button on the
 *   sidebar's own edge. The bottom edge is where the Windows taskbar and the
 *   macOS Dock live, so a control there is a mis-click waiting to happen.
 *
 *   **Grouped, not flat.** Seven items in a row is a list; three groups is a
 *   structure. "Today" is what she acts on now, "Records" is what explains a
 *   figure, "Setup" is what she changes rarely. The grouping says what kind of
 *   thing each destination is before she reads the label.
 *
 *   **Location scope at the top.** Location is the cutting dimension —
 *   architecture.md has it deciding what stock exists and which day an entry
 *   belongs to — so it applies to every destination, not to one page. Global
 *   controls belong in the global chrome, and in this frame the sidebar is the
 *   only permanently-visible global chrome.
 *
 *   **Active state is a filled block with a left rule**, not a grey wash. On a
 *   dark ground a subtle fill disappears; the rule in the accent survives, and
 *   it is the one place the accent is allowed inside the nav because it marks
 *   position rather than competing for a click.
 *
 * The footer carries one live figure — cash she should be holding. It makes the
 * nav ambient rather than pure furniture. Deliberately muted and un-clickable
 * as a figure; the link beneath it is what she presses. If it turns out to pull
 * attention away from the page, it is one block to delete.
 */

import { useEffect, useState } from "react";
import { type Destination } from "./admin-nav";
import { money } from "@/shared/money";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  LogOut,
  Settings,
  ArrowRight,
} from "lucide-react";

const KEY = "prosper-rail-open";

/** Three groups, so the list has a shape before the labels are read. */
const groups: { label: string; keys: string[] }[] = [
  { label: "Today", keys: ["dashboard", "money-out"] },
  { label: "Records", keys: ["ledger", "stock", "activity"] },
  { label: "Setup", keys: ["people", "catalogue"] },
];

export function useRailState() {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // localStorage is unavailable during SSR, so this can only run after
      // mount — the `ready` flag gates render until then to avoid a
      // hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setOpen(saved === "1");
    } catch {
      // Storage unavailable — the default is fine.
    }
    setReady(true);
  }, []);

  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // Not persisting is survivable.
      }
      return !v;
    });

  return { open, ready, toggle };
}

export function Sidebar({
  destinations,
  active,
  open,
  ready,
  toggle,
  onNavigate,
  staffName,
  cashExpected,
}: {
  destinations: Destination[];
  active: string;
  open: boolean;
  ready: boolean;
  /** Absent when the rail is inside a drawer — there is nothing to collapse. */
  toggle?: () => void;
  /** Closes the drawer after a tap. Absent on the permanent rail. */
  onNavigate?: () => void;
  /** The signed-in staff member's display name. */
  staffName: string;
  /** Cash the signed-in staff member should be holding. Absent to hide the figure. */
  cashExpected?: number;
}) {
  const inDrawer = !toggle;

  return (
    <aside
      className={`flex shrink-0 flex-col bg-sidebar text-sidebar-foreground ${
        inDrawer
          ? "h-full w-full"
          : `sticky top-0 hidden h-dvh transition-[width] duration-200 md:flex ${
              open ? "w-[216px]" : "w-[60px]"
            } ${ready ? "" : "invisible"}`
      }`}
    >
      {/* Identity, and the collapse — well clear of the bottom edge. */}
      <div
        className={`flex h-12 shrink-0 items-center border-b border-sidebar-border ${
          open ? "pr-1 pl-3" : "justify-center px-0"
        }`}
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
          P
        </div>
        {open && (
          <span className="ml-2 flex-1 truncate text-[13px] font-semibold">
            Prosper Hotel
          </span>
        )}
        {open && toggle && <CollapseButton open onClick={toggle} />}
      </div>

      {!open && toggle && (
        <div className="flex justify-center border-b border-sidebar-border py-1.5">
          <CollapseButton open={false} onClick={toggle} />
        </div>
      )}

      {/* Location scope — global, because it cuts every destination. */}
      {open ? (
        <div className="border-b border-sidebar-border p-2">
          <Select defaultValue="all">
            <SelectTrigger
              size="sm"
              className="h-8 w-full border-sidebar-border bg-white/5 text-[13px] text-sidebar-foreground hover:bg-white/10 focus-visible:ring-sidebar-primary/40 data-[placeholder]:text-sidebar-muted [&_svg]:text-sidebar-muted"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both locations</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="canteen">Canteen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex h-9 items-center justify-center border-b border-sidebar-border text-[11px] font-medium text-sidebar-muted hover:text-sidebar-foreground"
              aria-label="Location scope: both locations"
            >
              ALL
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Both locations</TooltipContent>
        </Tooltip>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        {groups.map((g, gi) => {
          const items = g.keys
            .map((k) => destinations.find((d) => d.key === k))
            .filter(Boolean) as Destination[];
          return (
            <div key={g.label} className={gi > 0 ? "mt-4" : ""}>
              {open ? (
                <div className="px-2 pb-1 text-[10px] font-medium tracking-wide text-sidebar-muted uppercase">
                  {g.label}
                </div>
              ) : (
                gi > 0 && <div className="mx-2 mb-2 border-t border-sidebar-border" />
              )}
              <div className="space-y-0.5">
                {items.map((d) => (
                  <NavItem
                    key={d.key}
                    d={d}
                    on={d.key === active}
                    open={open}
                    inDrawer={inDrawer}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* One live figure. The nav as ambient information, not pure furniture. */}
      {open && cashExpected !== undefined && (
        <div className="border-t border-sidebar-border px-3 py-2.5">
          <div className="text-[10px] text-sidebar-muted">Cash you should hold</div>
          <div className="tabular text-[15px] font-semibold">
            {money(cashExpected)}
          </div>
          <a
            href="#"
            className="mt-0.5 flex items-center gap-1 text-[11px] text-sidebar-muted transition-colors duration-100 hover:text-sidebar-foreground"
          >
            Count the drawer <ArrowRight className="size-3" />
          </a>
        </div>
      )}

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex h-9 w-full items-center gap-2 rounded-md text-[13px] transition-colors duration-100 hover:bg-sidebar-accent ${
                open ? "px-2" : "justify-center px-0"
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                {staffName.charAt(0).toUpperCase()}
              </span>
              {open && (
                <>
                  <span className="flex-1 truncate text-left">{staffName}</span>
                  <ChevronsUpDown className="size-3.5 text-sidebar-muted" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem>
              <Settings className="size-3.5" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="size-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function CollapseButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors duration-100 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {open ? "Collapse" : "Expand"} · ⌘B
      </TooltipContent>
    </Tooltip>
  );
}

function NavItem({
  d,
  on,
  open,
  inDrawer,
  onNavigate,
}: {
  d: Destination;
  on: boolean;
  open: boolean;
  inDrawer?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = d.icon;

  const body = (
    <a
      href={d.href}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      className={`relative flex items-center gap-2.5 rounded-md text-[13px] transition-colors duration-100 ${
        inDrawer ? "h-11" : "h-8"
      } ${
        open ? "px-2.5" : "justify-center px-0"
      } ${
        on
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      }`}
    >
      {/* Position marker. The one accent inside the nav — it marks where you
          are rather than competing for a click. */}
      {on && (
        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sidebar-primary" />
      )}
      <Icon className="size-4 shrink-0" />
      {open && <span className="flex-1 truncate">{d.label}</span>}
      {open && d.count && (
        <span
          className={`tabular flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium ${
            d.tone === "danger"
              ? "bg-danger text-danger-fg"
              : "bg-white/15 text-sidebar-foreground"
          }`}
        >
          {d.count}
        </span>
      )}
      {!open && d.count && (
        <span
          className={`absolute top-1 right-1 size-1.5 rounded-full ${
            d.tone === "danger" ? "bg-danger" : "bg-sidebar-muted"
          }`}
        />
      )}
    </a>
  );

  if (open || inDrawer) return body;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {body}
      </TooltipTrigger>
      <TooltipContent side="right">
        {d.label}
        {d.count ? ` · ${d.count} waiting` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
