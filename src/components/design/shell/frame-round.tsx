"use client";

/**
 * Stock, in the settled admin shell.
 *
 * The frame round is over: Rail's navigation, the brand-tinted rail, and the
 * two-band header all settled. What remains here is the state axis, because
 * Stock is where the four never-built states live and they are worth keeping
 * reachable until the templates are locked.
 *
 * Stock stays the page rather than the dashboard because it is the honest
 * stress case — a title, a caveat, a search box, three filters, a row count and
 * two actions. A page with two controls would let any frame look fine.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "./admin-shell";
import { StockBody, StockToolbar, type PageState } from "./stock-body";
import { productLedger } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";

const states: PageState[] = ["ready", "loading", "error", "denied", "first-use"];

const LOW = 12;

export function FrameRound() {
  const params = useSearchParams();
  const state = (params.get("state") as PageState) ?? "ready";

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [category, setCategory] = useState("all");
  const [low, setLow] = useState(false);

  const clear = () => {
    setQuery("");
    setLocation("all");
    setCategory("all");
    setLow(false);
  };

  const matching = productLedger.filter(
    (r) =>
      (location === "all" || r.location === location) &&
      (category === "all" || r.category === category) &&
      (!low || r.closingQty <= LOW) &&
      (!query.trim() ||
        r.item.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const busy = state !== "ready";

  return (
    <>
      <AdminShell
        active="stock"
        title="Stock"
        subtitle="What is on hand at both locations, and what it is worth"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="size-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="size-3.5" /> Take a count
            </Button>
          </>
        }
        toolbar={
          state === "denied" || state === "first-use" ? undefined : (
            <StockToolbar
              query={query}
              onQuery={setQuery}
              location={location}
              onLocation={setLocation}
              category={category}
              onCategory={setCategory}
              low={low}
              onLow={setLow}
              lowCount={productLedger.filter((r) => r.closingQty <= LOW).length}
              count={matching.length}
              total={productLedger.length}
              disabled={busy}
            />
          )
        }
      >
        <StockBody
          state={state}
          query={query}
          location={location}
          category={category}
          low={low}
          onClear={clear}
        />
      </AdminShell>

      <AccentSwitcher />
      <StateSwitcher current={state} />
    </>
  );
}

/** The state axis. Design-phase only, styled unlike the design being judged. */
function StateSwitcher({ current }: { current: PageState }) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 84,
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
          {s === "first-use" ? "empty" : s}
        </a>
      ))}
    </div>
  );
}
