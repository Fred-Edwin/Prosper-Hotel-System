"use client";

/**
 * Variant switcher for the design phase.
 *
 * Deliberately styled unlike anything in the design being judged, so it never
 * reads as part of it. Hidden in production. Deleted at lock along with the
 * losing variants.
 */

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface VariantDef {
  key: string;
  name: string;
  note: string;
}

export function useVariant(variants: VariantDef[]) {
  const params = useSearchParams();
  const requested = params.get("variant")?.toUpperCase();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === requested),
  );
  return { current: variants[index], index };
}

export function VariantSwitcher({ variants }: { variants: VariantDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { current, index } = useVariant(variants);

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

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        color: "#fafafa",
      }}
    >
      <button
        onClick={() => go(-1)}
        aria-label="Previous variant"
        style={btn}
      >
        ←
      </button>
      <div style={{ padding: "0 10px", textAlign: "center", minWidth: 190 }}>
        <div style={{ fontWeight: 600 }}>
          {current.key} · {current.name}
        </div>
        <div style={{ opacity: 0.6, fontSize: 10 }}>{current.note}</div>
      </div>
      <button onClick={() => go(1)} aria-label="Next variant" style={btn}>
        →
      </button>
    </div>
  );
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
