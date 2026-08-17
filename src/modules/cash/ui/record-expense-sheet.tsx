"use client";

/**
 * Variant A — sheet form. Same shape as Catalogue's EditSheet (product,
 * ingredient, recipe forms all open this way), so a "Record money out"
 * button opening a right-side sheet is the least surprising option to an
 * owner who already uses Catalogue.
 */

import { useState } from "react";
import { EditSheet } from "@/components/patterns/detail-page";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ExpenseFields, type ReceiptOption } from "./expense-fields";
import type { ExpenseView } from "./money-out-list";

export function RecordExpenseSheet({
  receipts,
  receiptsLoading,
  saving,
  error,
  onSave,
}: {
  receipts: ReceiptOption[];
  receiptsLoading?: boolean;
  saving?: boolean;
  error?: string;
  onSave: (input: {
    category: ExpenseView["category"];
    amountMinor: number;
    paymentMethod: ExpenseView["paymentMethod"];
    note: string | null;
    receiptId: string | null;
  }) => Promise<{ ok: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseView["category"]>("running");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpenseView["paymentMethod"]>("cash");
  const [note, setNote] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const reset = () => {
    setCategory("running");
    setAmount("");
    setPaymentMethod("cash");
    setNote("");
    setReceiptId(null);
  };

  const [showReceiptRequired, setShowReceiptRequired] = useState(false);

  return (
    <>
      <Button size="sm" className="h-8" onClick={() => setOpen(true)} data-testid="record-expense-open">
        <Plus className="size-3.5" /> Record an expense
      </Button>

      <EditSheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        title="Record an expense"
        description="What the business paid, and why."
        saveLabel="Record payment"
        saving={saving}
        formId="record-expense-form"
      >
        <form
          id="record-expense-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (category === "stock" && !receiptId) {
              setShowReceiptRequired(true);
              return;
            }
            const result = await onSave({
              category,
              amountMinor: Number(amount),
              paymentMethod,
              note: note.trim() || null,
              receiptId: category === "stock" ? receiptId : null,
            });
            if (result.ok) {
              setOpen(false);
              reset();
            }
          }}
        >
          <ExpenseFields
            category={category}
            onCategoryChange={(v) => {
              setCategory(v);
              if (v !== "stock") setReceiptId(null);
            }}
            amount={amount}
            onAmountChange={setAmount}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            note={note}
            onNoteChange={setNote}
            receiptId={receiptId}
            onReceiptChange={(v) => {
              setReceiptId(v);
              setShowReceiptRequired(false);
            }}
            receipts={receipts}
            receiptsLoading={receiptsLoading}
          />
          {showReceiptRequired && (
            <p className="mt-2 text-xs text-destructive" data-testid="expense-receipt-required">
              Pick which receipt this payment is for.
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs text-destructive" data-testid="record-expense-error">
              Couldn&apos;t record this payment. Try again.
            </p>
          )}
        </form>
      </EditSheet>
    </>
  );
}
