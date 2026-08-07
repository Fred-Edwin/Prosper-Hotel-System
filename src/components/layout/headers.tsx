"use client";

/**
 * The admin page header. Settled in the frame round.
 *
 * Two bands, doing genuinely different jobs:
 *
 *   The **header** carries what the page *is* and what you can do to it —
 *   breadcrumb, title, subtitle, page-level actions.
 *
 *   The **toolbar** carries what you are *currently looking at* — search,
 *   filters, counts, view controls.
 *
 * The split is the point. Page identity does not change when you filter, so it
 * should not share a band with the filters. It also gives every table page one
 * place to put its controls, instead of each table inventing a toolbar of its
 * own the way the ledger's did.
 *
 * The toolbar is sticky and the header is not. A filter you cannot reach
 * without scrolling back up is a filter you re-apply from memory; a title you
 * have already read is not worth 60px of a dense table's vertical space.
 *
 * A compact-on-scroll header was built alongside this and rejected — on pages
 * of this length it never diverged from the plain version enough to earn the
 * extra machinery. If a page appears that scrolls far enough for losing the
 * title to hurt, that is the moment to reconsider it, not before.
 */

import { CONTENT_MAX } from "./admin-nav";
import { ChevronRight } from "lucide-react";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Breadcrumb trail above the title, innermost last. */
  trail?: { label: string; href: string }[];
  /** Page-level actions, top-right. The primary action is the last one. */
  actions?: React.ReactNode;
  /** What you are currently looking at — search, filters, counts. */
  toolbar?: React.ReactNode;
}

function Trail({ trail }: { trail: HeaderProps["trail"] }) {
  if (!trail?.length) return null;
  return (
    <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
      {trail.map((t) => (
        <span key={t.label} className="flex items-center gap-1">
          <a
            href={t.href}
            className="transition-colors duration-100 hover:text-foreground"
          >
            {t.label}
          </a>
          <ChevronRight className="size-3 text-muted-foreground/50" />
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  trail,
  actions,
  toolbar,
}: HeaderProps) {
  return (
    <>
      <div className="border-b bg-card">
        <div className="mx-auto" style={{ maxWidth: CONTENT_MAX }}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
            <div>
              <Trail trail={trail} />
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle && (
                <p className="text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
        </div>
      </div>

      {toolbar && (
        <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto" style={{ maxWidth: CONTENT_MAX }}>
            <div className="flex flex-wrap items-center gap-2 px-6 py-2">
              {toolbar}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
