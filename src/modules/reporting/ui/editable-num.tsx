"use client";

/**
 * Editable-ledger T4 — the one editable ledger cell.
 *
 * Wraps the `Num` treatment every ledger figure already renders through,
 * so editing arrives as one component rather than fifty scattered cells,
 * and the reading experience is literally unchanged: same markup, same
 * `px-2 py-2` density, no mode toggle. `docs/design.md`'s "density over
 * comfort" stands unmodified.
 *
 * ## The interaction model: single click to focus, type to edit
 *
 * The spreadsheet model, deliberately, and *not* double-click. An earlier
 * draft of the plan chose double-click on the grounds that "a single stray
 * click must never begin altering financial history" — but entering an
 * edit alters nothing: Escape cancels, and committing is a separate,
 * deliberate keystroke. What double-click actually costs is
 * discoverability and the keyboard path, and reconciling a month of
 * figures is exactly the task where those matter.
 *
 * So:
 *   - single click (or arrow-key navigation) focuses. Nothing has changed.
 *   - typing a digit opens the editor with that digit as the whole value —
 *     the fast path, and the one she'll use.
 *   - Enter or a second click opens with the current value selected, so
 *     she can amend a long number instead of retyping it.
 *   - only 0-9, `.` and `-` open the editor. Every other key is inert, so
 *     a stray keystroke cannot begin an edit.
 *
 * Leaving:
 *   - Enter commits and moves down the column (spreadsheet convention).
 *   - Tab / Shift-Tab commit and move along the row.
 *   - Escape reverts and returns to focused, never commits.
 *   - clicking away commits. Blur-commits rather than blur-cancels because
 *     losing a typed value to a stray click is the more annoying failure,
 *     and Undo covers the other direction.
 *   - an unchanged value writes nothing at all: no request, no amendment,
 *     no toast. She can Enter through cells freely.
 *
 * ## Affordance
 *
 * **Nothing at rest; a neutral dotted underline on hover or focus.**
 *
 * An always-visible underline was built first and rejected on review
 * (2026-08-17): fourteen marked columns made the widest table in the app
 * hard to read, and reading is what it is mostly for. Since the resting
 * cell is now byte-identical to the read-only one, the reading experience
 * is unchanged in the strongest sense — not "visually similar", the same
 * markup with the same classes.
 *
 * Discoverability is the trade, and it is cheap here: there is one owner,
 * she asked for this feature, and the affordance appears the instant she
 * reaches for a cell.
 *
 * Never an accent, either way. `docs/design.md` allows one accent element
 * per screen; the accent belongs to Undo in the toast.
 *
 * A non-editable figure gets no underline and, where there is a reason
 * worth stating, a title explaining what to edit instead ("Profit is
 * calculated. Edit the quantity or price.").
 */

import { useEffect, useRef, useState } from "react";
import { money } from "@/shared/money";

export type EditableNumState = "idle" | "saving" | "error";

export type EditableNumProps = {
  value: number | null;
  /** Renders as money rather than a bare quantity. */
  asMoney?: boolean;
  /** Dash out a zero, matching the reading table's treatment. */
  muted?: boolean;
  tone?: "danger";
  strong?: boolean;
  /** Show an explicit + on positives — corrections only. */
  signed?: boolean;
  /**
   * Absent means this figure is not editable. When absent, `notEditableReason`
   * is shown as a tooltip so the cell explains itself rather than being
   * silently inert.
   */
  onCommit?: (newValue: number) => void;
  notEditableReason?: string;
  /** Per-cell in-flight and failure state, driven by the parent table. */
  state?: EditableNumState;
  /** What went wrong, shown on the cell itself — she needs to know *which*
   * cell failed, which a toast cannot tell her. */
  errorMessage?: string;
  /** Read-only mode for phones: editing a 16-column table under a thumb is
   * how the wrong cell gets changed (docs/design.md, laptop-first). */
  readOnly?: boolean;
  /** Announced to screen readers and used as the input's accessible name. */
  label?: string;
};

const OPENS_EDITOR = /^[0-9.\-]$/;

export function EditableNum({
  value,
  asMoney,
  muted,
  tone,
  strong,
  signed,
  onCommit,
  notEditableReason,
  state = "idle",
  errorMessage,
  readOnly,
  label,
}: EditableNumProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLSpanElement>(null);
  const selectOnOpen = useRef(false);
  // Set when the editor closes without moving focus elsewhere (Escape, or
  // a commit that stays put), so focus returns to the cell rather than
  // falling to <body>. Without this the type-Escape-retype rhythm breaks
  // after the first Escape, and keyboard navigation dies with it — the
  // whole reason for choosing single-click-plus-type over double-click.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing === null) {
      if (restoreFocus.current) {
        restoreFocus.current = false;
        cellRef.current?.focus();
      }
      return;
    }
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Enter/second-click open with the value selected so typing replaces
    // it but arrows can amend it; type-to-edit has already replaced it.
    if (selectOnOpen.current) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    selectOnOpen.current = false;
  }, [editing]);

  const editable = !!onCommit && !readOnly;

  const rendered = (() => {
    if (value === null) return "—";
    if (value === 0 && muted) return "—";
    const text = asMoney ? money(value) : String(value);
    return signed && value > 0 ? `+${text}` : text;
  })();

  function open(initial: string, select: boolean) {
    if (!editable) return;
    selectOnOpen.current = select;
    setEditing(initial);
  }

  function commit() {
    const raw = editing;
    setEditing(null);
    if (raw === null || !onCommit) return;
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    // An unchanged value is not an edit. No request, no amendment, no toast.
    if (parsed === value) return;
    onCommit(parsed);
  }

  if (!editable) {
    return (
      <span
        className={cellClass({ tone, strong, dim: value === null || (value === 0 && muted) })}
        title={notEditableReason}
        data-testid="editable-num-readonly"
      >
        {rendered}
      </span>
    );
  }

  if (editing !== null) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={editing}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            // Enter continues down the column, the spreadsheet convention
            // — the parent table owns focus movement.
            moveFocus(e.currentTarget, "down");
          } else if (e.key === "Escape") {
            e.preventDefault();
            restoreFocus.current = true;
            setEditing(null);
          }
          // Tab is deliberately not intercepted: the browser's own focus
          // order already walks the row, and onBlur commits.
        }}
        className="tabular w-full min-w-0 rounded-sm border border-ring bg-card px-1 py-0 text-right text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        data-testid="editable-num-input"
      />
    );
  }

  return (
    <span
      ref={cellRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => open(rendered === "—" ? "" : String(value ?? ""), true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          open(String(value ?? ""), true);
        } else if (OPENS_EDITOR.test(e.key)) {
          // Type-to-edit: the typed digit becomes the whole value.
          e.preventDefault();
          open(e.key, false);
        }
      }}
      title={errorMessage}
      aria-invalid={state === "error" || undefined}
      className={[
        cellClass({ tone, strong, dim: value === null || (value === 0 && muted) }),
        "cursor-text rounded-sm outline-none decoration-dotted underline-offset-4",
        // The affordance appears on hover/focus, never at rest. The ledger
        // is read far more often than it is edited, and marking all
        // fourteen editable columns turned the widest table in the app
        // into clutter — reviewed in Storybook 2026-08-17 and rejected.
        // Nothing here changes the resting table by a single pixel.
        "hover:underline hover:decoration-muted-foreground",
        "focus-visible:underline focus-visible:decoration-muted-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        // Saving keeps the number readable and merely dims it — never a
        // spinner replacing the figure, which would make the table
        // unreadable exactly when she is checking her own edit.
        state === "saving" ? "opacity-50" : "",
        state === "error" ? "text-danger decoration-danger" : "",
      ].join(" ")}
      data-testid="editable-num"
    >
      {rendered}
    </span>
  );
}

function cellClass({
  tone,
  strong,
  dim,
}: {
  tone?: "danger";
  strong?: boolean;
  dim?: boolean;
}) {
  return [
    "tabular",
    dim ? "text-muted-foreground" : "",
    tone === "danger" && !dim ? "text-danger" : "",
    strong ? "font-medium" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Moves focus to the cell above/below in the same column. Cells are found
 * by their column index within the row, so this survives the table
 * re-rendering after a save — which it must, since every commit replaces
 * the rows.
 */
function moveFocus(from: HTMLElement, direction: "down" | "up") {
  const cell = from.closest("td");
  const row = cell?.closest("tr");
  if (!cell || !row) return;
  const columnIndex = Array.from(row.children).indexOf(cell);
  const sibling = direction === "down" ? row.nextElementSibling : row.previousElementSibling;
  const targetCell = sibling?.children[columnIndex];
  const target = targetCell?.querySelector<HTMLElement>('[data-testid="editable-num"]');
  target?.focus();
}
