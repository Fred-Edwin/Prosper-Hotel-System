"use client";

/**
 * The admin shell — sidebar, header, content area.
 *
 * Rail won round A, so the sidebar is settled in kind if not in detail. This
 * composes it with a header, which round A left undecided: `header` selects one
 * of three treatments so the header is the only variable while the nav is held
 * constant.
 *
 * The shell publishes the rail's current width as `--rail-w`, because the
 * compact header is `fixed` and has to know where the sidebar ends. Anything
 * else that needs to span the content area can read the same variable rather
 * than hard-coding a number that drifts when the rail changes.
 */

import { useState } from "react";
import { Sidebar, useRailState } from "./sidebar";
import { PageHeader, type HeaderProps } from "./headers";
import { CONTENT_MAX, type Destination } from "./admin-nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function AdminShell({
  destinations,
  active = "dashboard",
  staffName,
  cashExpected,
  children,
  ...headerProps
}: HeaderProps & {
  destinations: Destination[];
  active?: string;
  staffName: string;
  cashExpected?: number;
  children: React.ReactNode;
}) {
  const { open, ready, toggle } = useRailState();
  const [drawer, setDrawer] = useState(false);

  return (
    <div
      className="flex min-h-dvh bg-background"
      style={
        { "--rail-w": open ? "216px" : "60px" } as React.CSSProperties
      }
    >
      <Sidebar
        destinations={destinations}
        active={active}
        open={open}
        ready={ready}
        toggle={toggle}
        staffName={staffName}
        cashExpected={cashExpected}
      />

      <div className="min-w-0 flex-1">
        {/* Under md the rail cannot be permanent, so it becomes a drawer —
            the same rail, not a different navigation.

            Admin has seven destinations across three groups, a location scope
            and a live figure. A bottom tab bar cannot hold that, and reducing
            it to four tabs plus "More" would hide half the app behind an
            overflow. The staff shell has three to six links and no groups,
            which is why it uses a launcher instead: the two shells navigate
            differently because they have genuinely different amounts to
            navigate. */}
        <div className="flex h-11 items-center gap-2 border-b bg-card px-4 md:hidden">
          <Sheet open={drawer} onOpenChange={setDrawer}>
            <SheetTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[264px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar
                destinations={destinations}
                active={active}
                open
                ready
                staffName={staffName}
                cashExpected={cashExpected}
                onNavigate={() => setDrawer(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="text-[13px] font-semibold">Prosper Hotel</span>
        </div>

        <PageHeader {...headerProps} />

        <main
          className="mx-auto px-6 pt-5 pb-8"
          style={{ maxWidth: CONTENT_MAX }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
