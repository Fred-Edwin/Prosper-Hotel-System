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
