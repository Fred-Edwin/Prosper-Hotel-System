"use client";

/**
 * The Expense form's fields — category, conditional receipt picker, amount,
 * note. Shared by all three record-form shells (sheet, dialog, inline
 * panel); what differs between them is the chrome around these fields, not
 * the fields themselves.
 */

import { Field } from "@/components/patterns/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/shared/money";
import type { ExpenseView } from "./money-out-list";

export type ReceiptOption = {
  receiptId: string;
  occurredAt: string;
  totalMinor: number;
  lineCount: number;
};

const categoryLabel: Record<ExpenseView["category"], string> = {
  stock: "Stock",
  running: "Running cost",
  asset: "Asset",
  drawing: "Drawing",
};

const categoryHint: Record<ExpenseView["category"], string> = {
  stock: "Goods or ingredients bought from a supplier. Reduces profit.",
  running: "Gas, charcoal, electricity, rent. Reduces profit in this period.",
  asset: "Furniture, utensils, equipment. Reduces cash, not profit — the business still owns it.",
  drawing: "Money you take for yourself. Not a business expense — recorded as a debt owed back.",
};

export function ExpenseFields({
  category,
  onCategoryChange,
  amount,
  onAmountChange,
  note,
  onNoteChange,
  receiptId,
  onReceiptChange,
  receipts,
  receiptsLoading,
}: {
  category: ExpenseView["category"];
  onCategoryChange: (v: ExpenseView["category"]) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  receiptId: string | null;
  onReceiptChange: (v: string) => void;
  receipts: ReceiptOption[];
  receiptsLoading?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field label="Category" required hint={categoryHint[category]}>
        <Select value={category} onValueChange={(v) => onCategoryChange(v as ExpenseView["category"])}>
          <SelectTrigger className="h-9 w-full" data-testid="expense-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(categoryLabel) as ExpenseView["category"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {categoryLabel[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {category === "stock" && (
        <Field label="Receipt" required hint="Which delivery this payment is for.">
          {receiptsLoading ? (
            <p className="text-xs text-muted-foreground">Loading receipts…</p>
          ) : receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No receipts recorded yet — record a delivery first.
            </p>
          ) : (
            <Select value={receiptId ?? ""} onValueChange={onReceiptChange}>
              <SelectTrigger className="h-9 w-full" data-testid="expense-receipt">
                <SelectValue placeholder="Pick a receipt" />
              </SelectTrigger>
              <SelectContent>
                {receipts.map((r) => (
                  <SelectItem key={r.receiptId} value={r.receiptId}>
                    {new Date(r.occurredAt).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {r.lineCount} {r.lineCount === 1 ? "item" : "items"} · {money(r.totalMinor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}

      <Field label="Amount" required>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          required
          placeholder="0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="h-9"
          data-testid="expense-amount"
        />
      </Field>

      <Field label="Note" hint="What this was for — optional but helps later.">
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          data-testid="expense-note"
        />
      </Field>
    </div>
  );
}
