"use client";

/**
 * Accent candidate switcher — design phase only.
 *
 * Stamps `data-accent` on <html>, which swaps the brand ramp in globals.css.
 * Sits beside the variant switcher and is deleted with it at lock, once the
 * accent is settled and its ramp becomes the only one in the file.
 */

import { useEffect, useState } from "react";

const candidates = [
  { key: "violet", label: "Violet — chosen", hue: "oklch(0.511 0.222 292)" },
  { key: "indigo", label: "Indigo", hue: "oklch(0.511 0.222 275)" },
  { key: "blue", label: "Blue", hue: "oklch(0.546 0.245 262)" },
];

const STORAGE_KEY = "design-accent";

export function AccentSwitcher() {
  const [accent, setAccent] = useState("violet");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setAccent(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem(STORAGE_KEY, accent);
    } catch {
      // Storage unavailable — the choice simply won't persist.
    }
  }, [accent]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        color: "#fafafa",
      }}
    >
      <span style={{ padding: "0 4px 0 6px", opacity: 0.6 }}>accent</span>
      {candidates.map((c) => (
        <button
          key={c.key}
          onClick={() => setAccent(c.key)}
          title={c.label}
          aria-label={`${c.label} accent`}
          aria-pressed={accent === c.key}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: c.hue,
            border:
              accent === c.key ? "2px solid #fafafa" : "2px solid transparent",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}
