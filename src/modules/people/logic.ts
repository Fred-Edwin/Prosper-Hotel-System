import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createCustomerRecord,
  createSession,
  deleteSession,
  findCustomerById as findCustomerByIdQuery,
  findSessionByToken,
  findStaffMemberByName,
  listCustomers as listCustomersQuery,
  updateCustomerRecord,
} from "./queries";
import type { Customer, Location, StaffMember, StaffRole } from "./schema";

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
