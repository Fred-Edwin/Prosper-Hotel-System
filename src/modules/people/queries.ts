import type { PrismaClient } from "@/generated/prisma/client";
import type { Location, StaffMember } from "./schema";

export async function findLocationByCode(
  db: PrismaClient,
  code: Location["code"],
): Promise<Location | null> {
  return db.location.findUnique({ where: { code } });
}

export async function findLocationById(
  db: PrismaClient,
  id: string,
): Promise<Location | null> {
  return db.location.findUnique({ where: { id } });
}

export async function findStaffMemberByPhone(
  db: PrismaClient,
  phone: string,
): Promise<(StaffMember & { pinHash: string }) | null> {
  return db.staffMember.findUnique({ where: { phone } });
}

export async function listActiveStaffAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<StaffMember[]> {
  return db.staffMember.findMany({
    where: { locationId, active: true },
    orderBy: { name: "asc" },
  });
}

export async function createSession(
  db: PrismaClient,
  staffMemberId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db.session.create({ data: { staffMemberId, token, expiresAt } });
}

export async function findSessionByToken(db: PrismaClient, token: string) {
  return db.session.findUnique({
    where: { token },
    include: { staffMember: { include: { location: true } } },
  });
}

export async function deleteSession(
  db: PrismaClient,
  token: string,
): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}
