import { Suspense } from "react";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "@/components/design/shell/admin-shell";
import { DashboardBody } from "@/components/design/shell/dashboard-body";
import { dashboard } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The settled dashboard in the settled shell.
 *
 * The three competing frames from round A are gone — Rail won and was rebuilt
 * with a brand-tinted ground, grouped navigation and a top-mounted collapse.
 * This is what the dashboard looks like inside it.
 *
 * The period control sits in the toolbar band rather than beside the title:
 * "which period am I looking at" is what you are currently viewing, not what
 * the page is, and the two-band header exists to keep those apart.
 */
export default function DashboardShellPage() {
  return (
    <Suspense>
      <AdminShell
        active="dashboard"
        title="Dashboard"
        subtitle="Today's figures, and what needs you"
        actions={
          <Button size="sm" className="h-8">
            Record money out
          </Button>
        }
        toolbar={
          <>
            <Tabs defaultValue="day">
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="ml-auto text-xs text-muted-foreground">
              {dashboard.period}
            </span>
          </>
        }
      >
        <DashboardBody />
      </AdminShell>
      <AccentSwitcher />
    </Suspense>
  );
}
