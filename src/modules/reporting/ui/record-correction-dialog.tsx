"use client";

/**
 * Record a correction — ticket 45's owner-only mechanism for a backdated
 * sale against a closed day (architecture.md's "Changing a closed day").
 * No Storybook/Design precedent for this exact composition exists, so it
 * is kept deliberately minimal per the ticket's own scope note ("a small
 * form/dialog, not a new page"): one product line, cash payment only,
 * required reason. Extending it to multi-line baskets or other payment
 * methods is not asked for here.
 *
 * Split into a fetching wrapper and a pure View, same split as every
 * other fetch-driven component here (cash-ledger.tsx, product-ledger.tsx)
 * — the View takes injected data so its Storybook story never touches the
 * network.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History } from "lucide-react";
import { money } from "@/shared/money";

export type Product = { id: string; name: string; priceMinor: number | null };
export type StaffMember = { id: string; name: string; locationId: string };
export type Location = { id: string; name: string };

async function fetchStaffAndLocations(): Promise<{ staff: StaffMember[]; locations: Location[] } | null> {
  try {
    const response = await fetch("/api/people/staff");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.staff) || !Array.isArray(body?.locations)) return null;
    return { staff: body.staff, locations: body.locations };
  } catch {
    return null;
  }
}

async function fetchProducts(locationId: string): Promise<Product[]> {
  try {
    const response = await fetch(
      `/api/catalogue/products/active?locationId=${encodeURIComponent(locationId)}`,
    );
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.products) ? body.products : [];
  } catch {
    return [];
  }
}

async function submitCorrection(input: {
  staffMemberId: string;
  locationId: string;
  effectiveDate: string;
  reason: string;
  productId: string;
  quantity: number;
  totalMinor: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/sales/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffMemberId: input.staffMemberId,
        locationId: input.locationId,
        effectiveDate: input.effectiveDate,
        reason: input.reason,
        lines: [{ productId: input.productId, quantity: input.quantity }],
        paymentLines: [{ method: "cash", amountMinor: input.totalMinor }],
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "Couldn't record the correction" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't record the correction" };
  }
}

export function RecordCorrectionDialog({ onRecorded }: { onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchStaffAndLocations().then((result) => {
      if (result) {
        setStaff(result.staff);
        setLocations(result.locations);
      }
    });
  }, [open]);

  return (
    <RecordCorrectionDialogView
      open={open}
      onOpenChange={setOpen}
      staff={staff}
      locations={locations}
      fetchProducts={fetchProducts}
      onSubmit={submitCorrection}
      onRecorded={() => {
        setOpen(false);
        onRecorded();
      }}
    />
  );
}

export function RecordCorrectionDialogView({
  open,
  onOpenChange,
  staff,
  locations,
  fetchProducts,
  onSubmit,
  onRecorded,
  initialReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember[];
  locations: Location[];
  fetchProducts: (locationId: string) => Promise<Product[]>;
  onSubmit: (input: {
    staffMemberId: string;
    locationId: string;
    effectiveDate: string;
    reason: string;
    productId: string;
    quantity: number;
    totalMinor: number;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRecorded: () => void;
  /** Storybook only, for the "reason required" validation state — the
   * real form always starts with reason untouched. */
  initialReason?: string;
}) {
  const [staffMemberId, setStaffMemberId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState(initialReason ?? "");
  const [reasonBlurred, setReasonBlurred] = useState(initialReason !== undefined);

  const [products, setProducts] = useState<Product[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    fetchProducts(locationId).then((result) => {
      if (!cancelled) setProducts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, fetchProducts]);

  function handleLocationChange(next: string) {
    setLocationId(next);
    setProductId("");
    setProducts([]);
  }

  const reasonTouched = reasonBlurred && reason.trim() === "";
  const canSubmit =
    staffMemberId !== "" &&
    locationId !== "" &&
    productId !== "" &&
    Number(quantity) > 0 &&
    effectiveDate !== "" &&
    reason.trim() !== "";

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const product = products.find((p) => p.id === productId);
    const priceMinor = product?.priceMinor ?? 0;
    const totalMinor = priceMinor * Number(quantity);

    const result = await onSubmit({
      staffMemberId,
      locationId,
      effectiveDate,
      reason: reason.trim(),
      productId,
      quantity: Number(quantity),
      totalMinor,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStaffMemberId("");
    setLocationId("");
    setProductId("");
    setProducts([]);
    setQuantity("1");
    setEffectiveDate("");
    setReason("");
    onRecorded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" data-testid="record-correction-trigger">
          <History className="size-3.5" /> Record a correction
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="record-correction-dialog">
        <DialogHeader>
          <DialogTitle>Record a correction</DialogTitle>
          <DialogDescription>
            A sale that belongs to a closed day. It is entered today but effective on the day it
            corrects — the original day&apos;s figures stay exactly as they were.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="correction-location">Location</Label>
            <Select value={locationId} onValueChange={handleLocationChange}>
              <SelectTrigger id="correction-location" className="w-full" data-testid="correction-location">
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-staff">Staff member</Label>
            <Select value={staffMemberId} onValueChange={setStaffMemberId}>
              <SelectTrigger id="correction-staff" className="w-full" data-testid="correction-staff">
                <SelectValue placeholder="Who made the sale" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  .filter((s) => !locationId || s.locationId === locationId)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="correction-product" className="w-full" data-testid="correction-product">
                <SelectValue placeholder="What was sold" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.priceMinor !== null ? ` — ${money(p.priceMinor)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-quantity">Quantity</Label>
            <Input
              id="correction-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="correction-quantity"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-date">Day it corrects</Label>
            <Input
              id="correction-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              data-testid="correction-date"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-reason">Reason</Label>
            <Textarea
              id="correction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReasonBlurred(true)}
              placeholder="Why this wasn't recorded on the day"
              data-testid="correction-reason"
            />
            {reasonTouched && (
              <p className="text-[11px] text-danger" data-testid="correction-reason-error">
                A reason is required for a correction.
              </p>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-danger" data-testid="correction-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            data-testid="correction-submit"
          >
            {submitting ? "Recording…" : "Record correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
