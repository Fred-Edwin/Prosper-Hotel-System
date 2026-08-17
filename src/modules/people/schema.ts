import type { LocationCode, StaffRole } from "@/generated/prisma/enums";

export type { LocationCode, StaffRole };

export type StaffMember = {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  locationId: string;
  dailyRateMinor: number;
  active: boolean;
};

export type Location = {
  id: string;
  code: LocationCode;
  name: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
};

export type DaysWorked = {
  id: string;
  staffMemberId: string;
  date: Date;
  recordedByStaffMemberId: string;
  paidAs: string | null;
};

// Editable-ledger T2 — one field-level edit to one record, of any type.
// See prisma/schema.prisma's Amendment for why this is generic rather than
// per-model columns. previousValue/newValue are display-only: nothing
// recomputes a figure from them.
export type Amendment = {
  id: string;
  recordType: string;
  recordId: string;
  field: string;
  previousValue: string;
  newValue: string;
  ledgerContext: string | null;
  effectiveDate: Date | null;
  locationId: string | null;
  staffMemberId: string;
  createdAt: Date;
};

// What a caller must supply to record one. `db` may be a transaction
// client: C2 requires the trail row and the data change to commit
// together, so recordAmendment is almost always called inside a
// db.$transaction alongside the write it describes.
export type AmendmentInput = {
  recordType: string;
  recordId: string;
  field: string;
  previousValue: string;
  newValue: string;
  staffMemberId: string;
  ledgerContext?: string | null;
  effectiveDate?: Date | null;
  locationId?: string | null;
};
