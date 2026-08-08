export type Handover = {
  id: string;
  locationId: string;
  staffMemberId: string;
  expectedCashMinor: number;
  expectedMpesaMinor: number;
  actualCashMinor: number;
  actualMpesaMinor: number;
  occurredAt: Date;
};
