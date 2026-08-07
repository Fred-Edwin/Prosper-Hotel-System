import type { PrismaClient } from "@/generated/prisma/client";
import type { Customer, Location, StaffMember } from "./schema";

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

export async function findStaffMemberByName(
  db: PrismaClient,
  name: string,
): Promise<(StaffMember & { pinHash: string }) | null> {
  return db.staffMember.findUnique({ where: { name } });
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

export async function createCustomerRecord(
  db: PrismaClient,
  data: { name: string; phone: string | null },
): Promise<Customer> {
  return db.customer.create({ data });
}

export async function updateCustomerRecord(
  db: PrismaClient,
  id: string,
  data: { name: string; phone: string | null },
): Promise<Customer> {
  return db.customer.update({ where: { id }, data });
}

export async function findCustomerById(
  db: PrismaClient,
  id: string,
): Promise<Customer | null> {
  return db.customer.findUnique({ where: { id } });
}

export async function listCustomers(db: PrismaClient): Promise<Customer[]> {
  return db.customer.findMany({ orderBy: { name: "asc" } });
}
