import type { PrismaClient } from "@/generated/prisma/client";
import type { Handover } from "./schema";

export async function findTodaysHandover(
  db: PrismaClient,
  staffMemberId: string,
  locationId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Handover | null> {
  return db.handover.findFirst({
    where: {
      staffMemberId,
      locationId,
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
  });
}

export async function createHandoverRecord(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    expectedCashMinor: number;
    expectedMpesaMinor: number;
    actualCashMinor: number;
    actualMpesaMinor: number;
  },
): Promise<Handover> {
  return db.handover.create({ data });
}

export async function updateHandoverActuals(
  db: PrismaClient,
  id: string,
  data: { actualCashMinor: number; actualMpesaMinor: number },
): Promise<Handover> {
  return db.handover.update({ where: { id }, data });
}
