"use client";

/**
 * Variant switcher for the design phase.
 *
 * Draggable, because a fixed bar covers exactly the bottom-of-screen summary
 * and action areas these designs put their most important content in.
 * Position persists across variant switches and reloads; double-click the
 * handle to reset it, or collapse it to a puck when it is still in the way.
 *
 * Deliberately styled unlike anything in the design being judged, so it never
 * reads as part of it. Hidden in production. Deleted at lock along with the
 * losing variants.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface VariantDef {
  key: string;
  name: string;
  note: string;
}

const STORAGE_KEY = "design-switcher-pos";

export function useVariant(variants: VariantDef[]) {
  const params = useSearchParams();
  const requested = params.get("variant")?.toUpperCase();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === requested),
  );
  return { current: variants[index], index };
}

interface Pos {
  x: number;
  y: number;
}

export function VariantSwitcher({ variants }: { variants: VariantDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { current, index } = useVariant(variants);

  const [pos, setPos] = useState<Pos | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const offset = useRef<Pos>({ x: 0, y: 0 });

  // Restore a saved position, clamped in case the window got smaller.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPos(clamp(JSON.parse(saved), ref.current));
    } catch {
      // Ignore malformed storage — the default position is fine.
    }
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = variants[(index + delta + variants.length) % variants.length];
      router.replace(`${pathname}?variant=${next.key}`, { scroll: false });
    },
    [index, pathname, router, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack arrows while the user is typing — the till is all inputs.
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;

      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const startDrag = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    offset.current = { x: e.clientX - box.left, y: e.clientY - box.top };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    const next = clamp(
      { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y },
      ref.current,
    );
    setPos(next);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        // Storage unavailable — position simply won't persist.
      }
    }
  };

  const reset = () => {
    setPos(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  };

  if (process.env.NODE_ENV === "production") return null;

  const placement: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x }
    : { bottom: 16, left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        color: "#fafafa",
        opacity: dragging ? 0.85 : 1,
        userSelect: "none",
        touchAction: "none",
        ...placement,
      }}
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
        title="Drag to move · double-click to reset"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          padding: "0 6px",
          fontSize: 14,
          lineHeight: 1,
          color: "#a1a1aa",
        }}
      >
        ⠿
      </div>

      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          style={{ ...btn, width: "auto", padding: "0 10px" }}
          title="Expand the variant switcher"
        >
          {current.key}
        </button>
      ) : (
        <>
          <button onClick={() => go(-1)} aria-label="Previous variant" style={btn}>
            ←
          </button>
          <div style={{ padding: "0 8px", textAlign: "center", minWidth: 180 }}>
            <div style={{ fontWeight: 600 }}>
              {current.key} · {current.name}
            </div>
            <div style={{ opacity: 0.6, fontSize: 10 }}>{current.note}</div>
          </div>
          <button onClick={() => go(1)} aria-label="Next variant" style={btn}>
            →
          </button>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse the variant switcher"
            style={{ ...btn, background: "transparent", color: "#a1a1aa" }}
            title="Collapse"
          >
            –
          </button>
        </>
      )}
    </div>
  );
}

function clamp(p: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 260;
  const h = el?.offsetHeight ?? 44;
  return {
    x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - w - 8)),
    y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - h - 8)),
  };
}

const btn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: "#3f3f46",
  color: "#fafafa",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
