/**
 * Editable-ledger T2 — the amendment trail, and BUG-01.
 *
 * proposal.md §8: "Non-financial corrections — a misspelled name or an
 * incorrect telephone number — are amended directly, with the previous
 * value retained." §9: "where a record has been amended, the record shows
 * that it was amended, by whom, and its previous value."
 *
 * Neither held. `updateStaffMemberRecord` and `updateCustomerRecord` were
 * bare `db.update` calls — the previous value was gone the instant the
 * owner pressed save. That is BUG-01, and these tests close it.
 *
 * The trail is deliberately generic (one `Amendment` row per field-level
 * edit, on any record type) rather than per-model `amendedFrom` columns,
 * because T3's ledger editing needs the same trail for stock quantities,
 * expense amounts and prices. A per-model design would have to be built
 * again for each.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { testDb } from "@/shared/test-db";
import { createCustomer, updateCustomer, updateStaffMember } from "../logic";
import { recordAmendment, listAmendmentsForRecord } from "../logic";

let restaurantId: string;
let ownerId: string;
let cashierId: string;
let subjectId: string;

function staffAt(role: "owner" | "cashier", id: string): AuthenticatedStaff {
  return {
    staff: {
      id,
      name: role === "owner" ? "Trail Owner" : "Trail Cashier",
      phone: role === "owner" ? "+254700333001" : "+254700333002",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

const owner = () => staffAt("owner", ownerId);
const cashier = () => staffAt("cashier", cashierId);

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Trail Restaurant" },
  });
  restaurantId = restaurant.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Trail Owner",
      phone: "+254700333001",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerRow.id;

  const cashierRow = await testDb.staffMember.create({
    data: {
      name: "Trail Cashier",
      phone: "+254700333002",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 500,
    },
  });
  cashierId = cashierRow.id;
});

afterEach(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.customer.deleteMany({});
  if (subjectId) {
    await testDb.staffMember.deleteMany({ where: { id: subjectId } });
    subjectId = "";
  }
});

afterAll(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.customer.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

async function makeSubject(name = "Jane Wanjiku", phone = "+254700333050") {
  const row = await testDb.staffMember.create({
    data: {
      name,
      phone,
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    },
  });
  subjectId = row.id;
  return row;
}

describe("recordAmendment", () => {
  test("stores what changed, from what, to what, by whom", async () => {
    await recordAmendment(testDb, {
      recordType: "Product",
      recordId: "product-1",
      field: "priceMinor",
      previousValue: "300",
      newValue: "350",
      staffMemberId: ownerId,
      ledgerContext: "selling price · Beef stew",
      locationId: restaurantId,
    });

    const rows = await listAmendmentsForRecord(testDb, "Product", "product-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recordType: "Product",
      recordId: "product-1",
      field: "priceMinor",
      previousValue: "300",
      newValue: "350",
      staffMemberId: ownerId,
      ledgerContext: "selling price · Beef stew",
      locationId: restaurantId,
    });
  });

  test("records effectiveDate separately from createdAt — the ledger day, not the typing day", async () => {
    // A 17 Aug edit to 16 Aug's figures. Conflating the two is the bug that
    // made the old effectiveAt mechanism useless (plan D5): the correction
    // landed in the wrong day's profit.
    const ledgerDay = new Date("2026-08-16T00:00:00.000Z");
    await recordAmendment(testDb, {
      recordType: "StockMovement",
      recordId: "movement-1",
      field: "received",
      previousValue: "3",
      newValue: "5",
      staffMemberId: ownerId,
      effectiveDate: ledgerDay,
      ledgerContext: "received · Beef stew · restaurant",
      locationId: restaurantId,
    });

    const rows = await listAmendmentsForRecord(testDb, "StockMovement", "movement-1");
    expect(rows[0]?.effectiveDate?.getTime()).toBe(ledgerDay.getTime());
    expect(rows[0]?.createdAt.getTime()).toBeGreaterThan(ledgerDay.getTime());
  });

  test("keeps every amendment to the same record, newest first — nothing is a terminal state", async () => {
    // C8: a wrong edit is fixed by another edit, never by overwriting the
    // trail. Three edits to one field leave three rows.
    for (const [previousValue, newValue] of [
      ["3", "5"],
      ["5", "4"],
      ["4", "6"],
    ]) {
      await recordAmendment(testDb, {
        recordType: "StockMovement",
        recordId: "movement-2",
        field: "received",
        previousValue,
        newValue,
        staffMemberId: ownerId,
      });
    }

    const rows = await listAmendmentsForRecord(testDb, "StockMovement", "movement-2");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => `${r.previousValue}->${r.newValue}`)).toEqual([
      "4->6",
      "5->4",
      "3->5",
    ]);
  });
});

describe("updateStaffMember — BUG-01", () => {
  test("retains the previous name when the owner corrects a misspelling", async () => {
    const subject = await makeSubject("Jane Wanjiuk");

    const result = await updateStaffMember(testDb, owner(), subject.id, {
      name: "Jane Wanjiku",
      phone: subject.phone,
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    });
    expect(result.ok).toBe(true);

    const rows = await listAmendmentsForRecord(testDb, "StaffMember", subject.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: "name",
      previousValue: "Jane Wanjiuk",
      newValue: "Jane Wanjiku",
      staffMemberId: ownerId,
    });
  });

  test("retains the previous phone number", async () => {
    const subject = await makeSubject("Jane Wanjiku", "+254700333051");

    await updateStaffMember(testDb, owner(), subject.id, {
      name: subject.name,
      phone: "+254700333052",
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    });

    const rows = await listAmendmentsForRecord(testDb, "StaffMember", subject.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: "phone",
      previousValue: "+254700333051",
      newValue: "+254700333052",
    });
  });

  test("records one amendment per changed field, and none for unchanged fields", async () => {
    const subject = await makeSubject("Jane Wanjiku", "+254700333053");

    await updateStaffMember(testDb, owner(), subject.id, {
      name: "Jane W. Kamau",
      phone: "+254700333054",
      role: "cashier",
      locationId: restaurantId,
      // unchanged — must not produce a row
      dailyRateMinor: 600,
    });

    const rows = await listAmendmentsForRecord(testDb, "StaffMember", subject.id);
    expect(rows.map((r) => r.field).sort()).toEqual(["name", "phone"]);
  });

  test("writes no amendment when nothing changed", async () => {
    const subject = await makeSubject("Jane Wanjiku", "+254700333055");

    await updateStaffMember(testDb, owner(), subject.id, {
      name: "Jane Wanjiku",
      phone: "+254700333055",
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    });

    expect(await listAmendmentsForRecord(testDb, "StaffMember", subject.id)).toEqual([]);
  });

  test("records the daily rate change, since pay is a financial figure", async () => {
    const subject = await makeSubject("Jane Wanjiku", "+254700333056");

    await updateStaffMember(testDb, owner(), subject.id, {
      name: subject.name,
      phone: subject.phone,
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 750,
    });

    const rows = await listAmendmentsForRecord(testDb, "StaffMember", subject.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: "dailyRateMinor",
      previousValue: "600",
      newValue: "750",
    });
  });

  test("a rejected edit leaves no amendment behind", async () => {
    // C2: the trail row and the data change commit together or not at all.
    // A duplicate-name rejection must not leave a row claiming an edit that
    // never happened.
    const subject = await makeSubject("Jane Wanjiku", "+254700333057");

    const result = await updateStaffMember(testDb, owner(), subject.id, {
      // Trail Cashier already holds this name.
      name: "Trail Cashier",
      phone: subject.phone,
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_name" });
    expect(await listAmendmentsForRecord(testDb, "StaffMember", subject.id)).toEqual([]);
  });

  test("a non-owner cannot amend, and leaves no trail", async () => {
    const subject = await makeSubject("Jane Wanjiku", "+254700333058");

    const result = await updateStaffMember(testDb, cashier(), subject.id, {
      name: "Someone Else",
      phone: subject.phone,
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 600,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(await listAmendmentsForRecord(testDb, "StaffMember", subject.id)).toEqual([]);
  });
});

describe("updateCustomer — BUG-01", () => {
  test("retains a customer's previous name and phone", async () => {
    const created = await createCustomer(testDb, owner(), {
      name: "Mama Njeri",
      phone: "+254700333060",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await updateCustomer(testDb, owner(), created.value.id, {
      name: "Mama Njeri Kamau",
      phone: "+254700333061",
    });

    const rows = await listAmendmentsForRecord(testDb, "Customer", created.value.id);
    expect(rows.map((r) => r.field).sort()).toEqual(["name", "phone"]);
    expect(rows.find((r) => r.field === "name")).toMatchObject({
      previousValue: "Mama Njeri",
      newValue: "Mama Njeri Kamau",
    });
  });

  test("records a phone being added where there was none", async () => {
    const created = await createCustomer(testDb, owner(), { name: "Walk-in", phone: null });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await updateCustomer(testDb, owner(), created.value.id, {
      name: "Walk-in",
      phone: "+254700333062",
    });

    const rows = await listAmendmentsForRecord(testDb, "Customer", created.value.id);
    expect(rows).toHaveLength(1);
    // An absent previous value reads as empty, not as the string "null".
    expect(rows[0]).toMatchObject({ field: "phone", previousValue: "", newValue: "+254700333062" });
  });
});
