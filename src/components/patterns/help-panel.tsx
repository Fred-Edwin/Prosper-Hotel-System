"use client";

/**
 * Explains the current screen: what it's for, what its actions do.
 * One component, two presentations — a slide-over above the mobile
 * breakpoint, a bottom sheet below it — chosen by screen width, not by
 * role, so the same person sees whichever matches the device they're
 * actually on. Content is static, pre-approved copy from
 * `help-content.ts`, keyed by nav destination and sectioned by tab
 * where that destination has more than one.
 *
 * On the staff shell, a screen's primary action owns the bottom edge
 * (docs/design.md) — the sheet opens above it, not over it, the same
 * way a keyboard would, via `bottomOffset`.
 */

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { helpContent, type HelpEntry } from "@/components/patterns/help-content";

export function HelpPanel({
  topic,
  /** Height in px reserved above a staff-shell bottom-anchored primary
   * action (e.g. "Complete sale"), so the sheet never covers it. */
  bottomOffset = 0,
}: {
  topic: keyof typeof helpContent;
  bottomOffset?: number;
}) {
  const entry: HelpEntry | undefined = helpContent[topic];
  const isMobile = useIsMobile();

  if (!entry) return null;

  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Help: ${entry.title}`}
              data-testid="help-trigger"
            >
              <HelpCircle />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Help</TooltipContent>
      </Tooltip>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="overflow-y-auto"
        style={isMobile && bottomOffset ? { bottom: bottomOffset } : undefined}
        data-testid="help-panel"
      >
        <SheetHeader>
          <SheetTitle>{entry.title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          {entry.sections.map((section) => (
            <div key={section.heading} className="flex flex-col gap-2">
              {entry.sections.length > 1 && (
                <h3 className="font-heading text-sm font-medium text-foreground">
                  {section.heading}
                </h3>
              )}
              <p className="text-sm text-muted-foreground">{section.summary}</p>
              <ul className="flex flex-col gap-1.5 text-sm text-foreground">
                {section.points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
