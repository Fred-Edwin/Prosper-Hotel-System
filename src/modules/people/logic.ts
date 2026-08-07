import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createSession,
  deleteSession,
  findSessionByToken,
  findStaffMemberByPhone,
} from "./queries";
import type { Location, StaffMember, StaffRole } from "./schema";

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
  phone: string,
  pin: string,
): Promise<LoginResult> {
  const staffMember = await findStaffMemberByPhone(db, phone);
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
