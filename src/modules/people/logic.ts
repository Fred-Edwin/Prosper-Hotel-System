import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createCustomerRecord,
  createSession,
  createStaffMemberRecord,
  deleteSession,
  findCustomerById as findCustomerByIdQuery,
  findSessionByToken,
  findStaffMemberByName,
  findStaffMemberByPhone,
  findStaffMemberById as findStaffMemberByIdQuery,
  listAllStaff,
  listCustomers as listCustomersQuery,
  listDaysWorked,
  listDaysWorkedInPeriod,
  listDaysWorkedInPeriodAllStaff,
  listUnpaidDaysWorkedInPeriod,
  markDaysWorkedPaid as markDaysWorkedPaidQuery,
  setStaffMemberActive,
  updateCustomerRecord,
  updateStaffMemberRecord,
  upsertDaysWorked,
} from "./queries";
import type { Customer, DaysWorked, Location, StaffMember, StaffRole } from "./schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type AuthenticatedStaff = {
  staff: StaffMember;
  location: Location;
};

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; staff: StaffMember }
  | { ok: false; reason: "invalid_credentials" | "inactive" };

export async function login(
  db: PrismaClient,
  name: string,
  pin: string,
): Promise<LoginResult> {
  const staffMember = await findStaffMemberByName(db, name);
  if (!staffMember) return { ok: false, reason: "invalid_credentials" };

  const pinMatches = await bcrypt.compare(pin, staffMember.pinHash);
  if (!pinMatches) return { ok: false, reason: "invalid_credentials" };

  if (!staffMember.active) return { ok: false, reason: "inactive" };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await createSession(db, staffMember.id, token, expiresAt);

  const { pinHash: _pinHash, ...staff } = staffMember;
  return { ok: true, token, expiresAt, staff };
}

export async function logout(db: PrismaClient, token: string): Promise<void> {
  await deleteSession(db, token);
}

export async function getAuthenticatedStaff(
  db: PrismaClient,
  token: string,
): Promise<AuthenticatedStaff | null> {
  const session = await findSessionByToken(db, token);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await deleteSession(db, token);
    return null;
  }
  if (!session.staffMember.active) return null;

  const { pinHash: _pinHash, location, ...staff } = session.staffMember;
  return { staff, location };
}

// docs/architecture.md: staff see their own location only; the owner sees
// both. This is the one place that decision is made.
export function canAccessLocation(
  role: StaffRole,
  staffLocationId: string,
  targetLocationId: string,
): boolean {
  if (role === "owner") return true;
  return staffLocationId === targetLocationId;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

type StaffWriteResult =
  | { ok: true; value: StaffMember }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "invalid_name" | "invalid_phone" | "invalid_pin" | "duplicate_name" | "duplicate_phone";
    };

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

// ADR 0007: login is a name and a four-digit PIN.
function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// proposal.md §11: staff are added and deactivated by the owner. This is
// the only write path in this module gated to the owner role, matching
// catalogue's Product/Ingredient pattern.
export async function createStaffMember(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    name: string;
    phone: string;
    role: StaffRole;
    locationId: string;
    pin: string;
    dailyRateMinor: number;
  },
): Promise<StaffWriteResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const name = input.name.trim();
  if (!name) return { ok: false, reason: "invalid_name" };

  const phone = input.phone.trim();
  if (!phone) return { ok: false, reason: "invalid_phone" };

  if (!isValidPin(input.pin)) return { ok: false, reason: "invalid_pin" };

  const existingName = await findStaffMemberByName(db, name);
  if (existingName) return { ok: false, reason: "duplicate_name" };

  const existingPhone = await findStaffMemberByPhone(db, phone);
  if (existingPhone) return { ok: false, reason: "duplicate_phone" };

  const pinHash = await hashPin(input.pin);
  const staffMember = await createStaffMemberRecord(db, {
    name,
    phone,
    pinHash,
    role: input.role,
    locationId: input.locationId,
    dailyRateMinor: input.dailyRateMinor,
  });
  return { ok: true, value: staffMember };
}

// Lifecycle ticket: name, phone, role, location, daily rate and PIN are
// all non-financial, in-place edits — architecture.md's "non-financial
// typos... are edited in place" rule, extended to a staff record's own
// fields. PIN is optional here: omitting it keeps the current PIN.
export async function updateStaffMember(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  input: {
    name: string;
    phone: string;
    role: StaffRole;
    locationId: string;
    dailyRateMinor: number;
    pin?: string;
  },
): Promise<StaffWriteResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findStaffMemberByIdQuery(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  const name = input.name.trim();
  if (!name) return { ok: false, reason: "invalid_name" };

  const phone = input.phone.trim();
  if (!phone) return { ok: false, reason: "invalid_phone" };

  if (name !== current.name) {
    const existingName = await findStaffMemberByName(db, name);
    if (existingName) return { ok: false, reason: "duplicate_name" };
  }

  if (phone !== current.phone) {
    const existingPhone = await findStaffMemberByPhone(db, phone);
    if (existingPhone) return { ok: false, reason: "duplicate_phone" };
  }

  let pinHash: string | undefined;
  if (input.pin !== undefined) {
    if (!isValidPin(input.pin)) return { ok: false, reason: "invalid_pin" };
    pinHash = await hashPin(input.pin);
  }

  const staffMember = await updateStaffMemberRecord(db, id, {
    name,
    phone,
    pinHash,
    role: input.role,
    locationId: input.locationId,
    dailyRateMinor: input.dailyRateMinor,
  });
  return { ok: true, value: staffMember };
}

// Deactivate, never delete — a former employee's sales, movements and
// handovers must stay attributed to them. Exactly
// deactivateProduct/deactivateIngredient's pattern.
export async function deactivateStaffMember(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<StaffWriteResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findStaffMemberByIdQuery(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setStaffMemberActive(db, id, false) };
}

export async function reactivateStaffMember(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<StaffWriteResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findStaffMemberByIdQuery(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setStaffMemberActive(db, id, true) };
}

// Owner-only, same as the write paths above — pay/rate/role is
// managerial data, per proposal.md's role list.
export async function listStaffMembers(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<{ ok: true; value: StaffMember[] } | { ok: false; reason: "forbidden" }> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  return { ok: true, value: await listAllStaff(db) };
}

type CustomerWriteResult =
  | { ok: true; value: Customer }
  | { ok: false; reason: "invalid_name" | "not_found" };

// CONTEXT.md: most trade is anonymous and creates no customer — creating
// one is a low-stakes, frequent staff action, not an admin setup task, so
// no owner gate (unlike catalogue's create/update).
export async function createCustomer(
  db: PrismaClient,
  _requester: AuthenticatedStaff,
  input: { name: string; phone?: string | null },
): Promise<CustomerWriteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "invalid_name" };

  const customer = await createCustomerRecord(db, {
    name,
    phone: input.phone ?? null,
  });
  return { ok: true, value: customer };
}

export async function updateCustomer(
  db: PrismaClient,
  _requester: AuthenticatedStaff,
  id: string,
  input: { name: string; phone?: string | null },
): Promise<CustomerWriteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "invalid_name" };

  const current = await findCustomerByIdQuery(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  const customer = await updateCustomerRecord(db, id, {
    name,
    phone: input.phone ?? null,
  });
  return { ok: true, value: customer };
}

export async function findCustomerById(
  db: PrismaClient,
  id: string,
): Promise<Customer | null> {
  return findCustomerByIdQuery(db, id);
}

export async function listCustomers(db: PrismaClient): Promise<Customer[]> {
  return listCustomersQuery(db);
}

// proposal.md §11 is silent on pay period; ticket 35 confirmed the current
// calendar month as the simplest useful default — Stage 8 owns arbitrary
// historical periods.
export function currentMonthBounds(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}

type DaysWorkedWriteResult =
  | { ok: true; value: DaysWorked }
  | { ok: false; reason: "forbidden" | "not_found" };

// proposal.md §11: "Days worked are recorded" by the owner, directly — not
// inferred from other activity. Same-day-same-person is an edit in place
// (queries.ts's upsert on the unique constraint), matching the project's
// general fast-entry-correction pattern.
export async function recordDaysWorked(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { staffMemberId: string; date: Date },
): Promise<DaysWorkedWriteResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const staffMember = await findStaffMemberByIdQuery(db, input.staffMemberId);
  if (!staffMember) return { ok: false, reason: "not_found" };

  const value = await upsertDaysWorked(db, {
    staffMemberId: input.staffMemberId,
    date: input.date,
    recordedByStaffMemberId: requester.staff.id,
  });
  return { ok: true, value };
}

type DaysWorkedListResult =
  | { ok: true; value: DaysWorked[] }
  | { ok: false; reason: "forbidden" | "not_found" };

// Owner-only, same gate as listStaffMembers — pay-adjacent data.
export async function listDaysWorkedForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  staffMemberId: string,
): Promise<DaysWorkedListResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const staffMember = await findStaffMemberByIdQuery(db, staffMemberId);
  if (!staffMember) return { ok: false, reason: "not_found" };

  return { ok: true, value: await listDaysWorked(db, staffMemberId) };
}

type DaysWorkedForActivityResult =
  | { ok: true; value: DaysWorked[] }
  | { ok: false; reason: "forbidden" };

// Ticket 45 — Activity's days-worked rows, business-wide (every staff
// member) in a period. Owner-only, same gate as listDaysWorkedForStaff.
export async function getDaysWorkedForActivity(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
): Promise<DaysWorkedForActivityResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  return { ok: true, value: await listDaysWorkedInPeriodAllStaff(db, periodStart, periodEnd) };
}

export type PayForStaff = {
  daysWorked: number;
  dailyRateMinor: number;
  payMinor: number;
  unpaidDaysWorked: number;
  unpaidMinor: number;
};

type GetPayForStaffResult =
  | { ok: true; value: PayForStaff }
  | { ok: false; reason: "forbidden" | "not_found" };

// proposal.md §11: "Pay is calculated as days worked multiplied by the
// daily rate." Current calendar month only — see currentMonthBounds.
export async function getPayForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  staffMemberId: string,
): Promise<GetPayForStaffResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const staffMember = await findStaffMemberByIdQuery(db, staffMemberId);
  if (!staffMember) return { ok: false, reason: "not_found" };

  const { periodStart, periodEnd } = currentMonthBounds();
  const [days, unpaid] = await Promise.all([
    listDaysWorkedInPeriod(db, staffMemberId, periodStart, periodEnd),
    listUnpaidDaysWorkedInPeriod(db, staffMemberId, periodStart, periodEnd),
  ]);

  return {
    ok: true,
    value: {
      daysWorked: days.length,
      dailyRateMinor: staffMember.dailyRateMinor,
      payMinor: days.length * staffMember.dailyRateMinor,
      unpaidDaysWorked: unpaid.length,
      unpaidMinor: unpaid.length * staffMember.dailyRateMinor,
    },
  };
}

// Ticket 35: called by cash/logic.ts's payWages after it creates the
// running Expense — cash never reaches past people's index.ts, so this is
// the one place a wage payment's Expense id gets written onto the
// DaysWorked rows it covers (paidAs, mirroring Expense.receiptId).
export async function markDaysWorkedPaid(
  db: PrismaClient,
  staffMemberId: string,
  paidAs: string,
): Promise<{ ids: string[]; amountMinor: number }> {
  const { periodStart, periodEnd } = currentMonthBounds();
  const unpaid = await listUnpaidDaysWorkedInPeriod(db, staffMemberId, periodStart, periodEnd);
  if (unpaid.length === 0) return { ids: [], amountMinor: 0 };

  const staffMember = await findStaffMemberByIdQuery(db, staffMemberId);
  const dailyRateMinor = staffMember?.dailyRateMinor ?? 0;

  await markDaysWorkedPaidQuery(
    db,
    unpaid.map((d) => d.id),
    paidAs,
  );
  return { ids: unpaid.map((d) => d.id), amountMinor: unpaid.length * dailyRateMinor };
}
