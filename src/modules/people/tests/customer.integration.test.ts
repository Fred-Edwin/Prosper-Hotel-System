import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "../index";
import { createCustomer, findCustomerById, listCustomers, updateCustomer, hashPin } from "../index";
import { testDb } from "@/shared/test-db";

// The requester is a real row rather than a synthetic id (editable-ledger
// T2): editing a customer now writes an Amendment attributing the change,
// and an amendment must name a staff member who exists. An edit that
// cannot be attributed does not happen — D3 makes the trail a guarantee,
// not best-effort.
let restaurantId: string;
let cashierId: string;

function staffAt(role: "owner" | "cashier"): AuthenticatedStaff {
  return {
    staff: {
      id: cashierId,
      name: "Test Staff",
      phone: "+254700111555",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

const cashier = () => staffAt("cashier");

beforeAll(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.customer.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;
  const staff = await testDb.staffMember.create({
    data: {
      name: "Test Staff",
      phone: "+254700111555",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  cashierId = staff.id;
});

afterAll(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.customer.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.customer.deleteMany({});
});

describe("customers", () => {
  test("any authenticated staff can create a customer with just a name", async () => {
    const result = await createCustomer(testDb, cashier(), { name: "Jane Wanjiru" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Jane Wanjiru");
    expect(result.value.phone).toBeNull();
  });

  test("lists customers alphabetically by name", async () => {
    await createCustomer(testDb, cashier(), { name: "Zawadi" });
    await createCustomer(testDb, cashier(), { name: "Amani" });

    const customers = await listCustomers(testDb);

    expect(customers.map((c) => c.name)).toEqual(["Amani", "Zawadi"]);
  });

  test("finds a customer by id", async () => {
    const created = await createCustomer(testDb, cashier(), {
      name: "Brian Otieno",
      phone: "0722000111",
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const found = await findCustomerById(testDb, created.value.id);

    expect(found).toEqual(created.value);
  });

  test("returns null for an unknown id", async () => {
    expect(await findCustomerById(testDb, "nonexistent")).toBeNull();
  });

  test("edits a customer's name and phone in place", async () => {
    const created = await createCustomer(testDb, cashier(), { name: "Brian" });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateCustomer(testDb, cashier(), created.value.id, {
      name: "Brian Otieno",
      phone: "0722000111",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Brian Otieno");
    expect(result.value.phone).toBe("0722000111");
  });

  test("allows two customers to share the same name", async () => {
    const first = await createCustomer(testDb, cashier(), { name: "John Kamau" });
    const second = await createCustomer(testDb, cashier(), { name: "John Kamau" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  test("rejects updating an unknown customer", async () => {
    const result = await updateCustomer(testDb, cashier(), "nonexistent", { name: "Someone" });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("rejects creating a customer with a blank name", async () => {
    const result = await createCustomer(testDb, cashier(), { name: "   " });

    expect(result).toEqual({ ok: false, reason: "invalid_name" });
  });
});
