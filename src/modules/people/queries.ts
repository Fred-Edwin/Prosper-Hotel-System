import type { PrismaClient } from "@/generated/prisma/client";
import type { Customer, DaysWorked, Location, StaffMember } from "./schema";

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

// docs/architecture.md: LocationCode only ever has two values — no
// pagination or filtering needed for a picker built from this.
export async function listLocations(db: PrismaClient): Promise<Location[]> {
  return db.location.findMany({ orderBy: { name: "asc" } });
}

export async function findStaffMemberByName(
  db: PrismaClient,
  name: string,
): Promise<(StaffMember & { pinHash: string }) | null> {
  return db.staffMember.findUnique({ where: { name } });
}

export async function findStaffMembersByIds(db: PrismaClient, ids: string[]): Promise<StaffMember[]> {
  return db.staffMember.findMany({ where: { id: { in: ids } } });
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

export async function listAllStaff(db: PrismaClient): Promise<StaffMember[]> {
  return db.staffMember.findMany({ orderBy: { name: "asc" } });
}

export async function findStaffMemberById(
  db: PrismaClient,
  id: string,
): Promise<StaffMember | null> {
  return db.staffMember.findUnique({ where: { id } });
}

export async function findStaffMemberByPhone(
  db: PrismaClient,
  phone: string,
): Promise<StaffMember | null> {
  return db.staffMember.findUnique({ where: { phone } });
}

export async function createStaffMemberRecord(
  db: PrismaClient,
  data: {
    name: string;
    phone: string;
    pinHash: string;
    role: StaffMember["role"];
    locationId: string;
    dailyRateMinor: number;
  },
): Promise<StaffMember> {
  return db.staffMember.create({ data });
}

export async function updateStaffMemberRecord(
  db: PrismaClient,
  id: string,
  data: {
    name: string;
    phone: string;
    pinHash?: string;
    role: StaffMember["role"];
    locationId: string;
    dailyRateMinor: number;
  },
): Promise<StaffMember> {
  return db.staffMember.update({ where: { id }, data });
}

export async function setStaffMemberActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<StaffMember> {
  return db.staffMember.update({ where: { id }, data: { active } });
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

// proposal.md §11 / ticket 35: recording the same staff member/date twice
// is an edit in place, enforced by DaysWorked's @@unique([staffMemberId,
// date]) — upsert is the natural fit for that constraint.
export async function upsertDaysWorked(
  db: PrismaClient,
  data: { staffMemberId: string; date: Date; recordedByStaffMemberId: string },
): Promise<DaysWorked> {
  return db.daysWorked.upsert({
    where: { staffMemberId_date: { staffMemberId: data.staffMemberId, date: data.date } },
    create: data,
    update: { recordedByStaffMemberId: data.recordedByStaffMemberId },
  });
}

export async function listDaysWorked(
  db: PrismaClient,
  staffMemberId: string,
): Promise<DaysWorked[]> {
  return db.daysWorked.findMany({
    where: { staffMemberId },
    orderBy: { date: "desc" },
  });
}

export async function listDaysWorkedInPeriod(
  db: PrismaClient,
  staffMemberId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DaysWorked[]> {
  return db.daysWorked.findMany({
    where: { staffMemberId, date: { gte: periodStart, lt: periodEnd } },
    orderBy: { date: "asc" },
  });
}

// Ticket 35: the unpaid days a wage payment will cover — paidAs mirrors
// Expense.receiptId's grouping-value pattern, set once a payment covers a
// day and left null until then.
export async function listUnpaidDaysWorkedInPeriod(
  db: PrismaClient,
  staffMemberId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DaysWorked[]> {
  return db.daysWorked.findMany({
    where: {
      staffMemberId,
      paidAs: null,
      date: { gte: periodStart, lt: periodEnd },
    },
    orderBy: { date: "asc" },
  });
}

export async function markDaysWorkedPaid(
  db: PrismaClient,
  ids: string[],
  paidAs: string,
): Promise<void> {
  await db.daysWorked.updateMany({ where: { id: { in: ids } }, data: { paidAs } });
}
