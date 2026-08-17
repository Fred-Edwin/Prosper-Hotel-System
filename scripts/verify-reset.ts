// Confirms the 2026-08-17 reset landed correctly: stock figures match the
// pre-wipe snapshot item for item, the transactional tables are empty, and
// every movement written is a `corrected` opening balance rather than a
// fabricated purchase.
//
// READ-ONLY. This script never writes to the database.
//
// This is the proof the operation worked. If the stock diff is not empty,
// the reset did not reproduce the owner's position and the pg_dump should
// be restored rather than trading on wrong figures.
//
// Usage: npx tsx scripts/verify-reset.ts --snapshot <path>

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  sumMovementsByProductAtLocation,
  sumMovementsByIngredientAtLocation,
} from "@/modules/stock/queries";

const snapFlagIndex = process.argv.indexOf("--snapshot");
const snapshotPath = snapFlagIndex !== -1 ? process.argv[snapFlagIndex + 1] : null;
if (!snapshotPath) {
  console.error("Usage: npx tsx scripts/verify-reset.ts --snapshot <path>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type Snapshot = {
  takenAt: string;
  // Catalogue row counts at capture time — the baseline for confirming the
  // wipe kept what it was meant to. Optional: snapshots from an earlier
  // revision of snapshot-stock.ts do not carry it.
  catalogueCounts?: Record<string, number>;
  items: { productId: string; name: string; locationCode: string; quantityOnHand: number }[];
  ingredients: {
    ingredientId: string;
    name: string;
    locationCode: string;
    quantityOnHand: number;
  }[];
};

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath!, "utf-8")) as Snapshot;
  const failures: string[] = [];

  // --- 1. Stock figures match the snapshot, item for item ----------------
  const locations = await db.location.findMany();
  const current = new Map<string, number>();

  for (const location of locations) {
    for (const sum of await sumMovementsByProductAtLocation(db, location.id)) {
      current.set(`product:${sum.productId}:${location.code}`, sum.quantityOnHand);
    }
    for (const sum of await sumMovementsByIngredientAtLocation(db, location.id)) {
      current.set(`ingredient:${sum.ingredientId}:${location.code}`, sum.quantityOnHand);
    }
  }

  const expected = new Map<string, { name: string; qty: number }>();
  for (const i of snapshot.items) {
    expected.set(`product:${i.productId}:${i.locationCode}`, {
      name: i.name,
      qty: i.quantityOnHand,
    });
  }
  for (const i of snapshot.ingredients) {
    expected.set(`ingredient:${i.ingredientId}:${i.locationCode}`, {
      name: i.name,
      qty: i.quantityOnHand,
    });
  }

  let matched = 0;
  for (const [key, exp] of expected) {
    const actual = current.get(key) ?? 0;
    if (Math.abs(actual - exp.qty) > 0.001) {
      failures.push(`STOCK MISMATCH: ${exp.name} (${key}) — expected ${exp.qty}, got ${actual}`);
    } else {
      matched++;
    }
  }

  // Anything holding stock now that held none before is stock we invented.
  for (const [key, qty] of current) {
    if (!expected.has(key) && qty !== 0) {
      failures.push(`UNEXPECTED STOCK: ${key} holds ${qty} but was absent from the snapshot`);
    }
  }

  // --- 2. Transactional tables are empty ---------------------------------
  const shouldBeEmpty = {
    sale: await db.sale.count(),
    saleLine: await db.saleLine.count(),
    paymentLine: await db.paymentLine.count(),
    expense: await db.expense.count(),
    handover: await db.handover.count(),
    transfer: await db.transfer.count(),
    repayment: await db.repayment.count(),
    drawingDebt: await db.drawingDebt.count(),
    drawingRepayment: await db.drawingRepayment.count(),
    customer: await db.customer.count(),
  };
  for (const [table, count] of Object.entries(shouldBeEmpty)) {
    if (count > 0) failures.push(`NOT EMPTY: ${table} still has ${count} row(s)`);
  }

  // --- 3. Every movement is a `corrected` opening balance ----------------
  // A `received` row here would mean the reload fabricated a purchase,
  // which would corrupt cost-of-goods-sold and the running-average cost.
  const byReason = await db.stockMovement.groupBy({ by: ["reason"], _count: true });
  const ingByReason = await db.ingredientMovement.groupBy({ by: ["reason"], _count: true });

  for (const row of [...byReason, ...ingByReason]) {
    if (row.reason !== "corrected") {
      failures.push(
        `UNEXPECTED MOVEMENT REASON: ${row._count} row(s) with reason "${row.reason}" — ` +
          `every movement after the reset should be "corrected".`,
      );
    }
  }

  // --- 4. Catalogue survived ---------------------------------------------
  const kept = {
    product: await db.product.count(),
    category: await db.category.count(),
    ingredient: await db.ingredient.count(),
    recipe: await db.recipe.count(),
    staffMember: await db.staffMember.count(),
    location: await db.location.count(),
  };
  // Products, staff and locations must exist for the system to function at
  // all, so an empty one is unambiguously a loss. Categories, recipes and
  // (on some deployments) ingredients may legitimately be empty before the
  // reset — the snapshot's own catalogueCounts, captured pre-wipe, is the
  // only honest baseline for those. Absent that field (snapshots taken by
  // an older revision of snapshot-stock.ts), they are skipped rather than
  // guessed at.
  const mustBeNonEmpty = ["product", "staffMember", "location"] as const;
  for (const table of mustBeNonEmpty) {
    if (kept[table] === 0) {
      failures.push(`CATALOGUE LOST: ${table} is empty — it should have survived`);
    }
  }

  if (snapshot.catalogueCounts) {
    for (const [table, before] of Object.entries(snapshot.catalogueCounts)) {
      const after = kept[table as keyof typeof kept];
      if (after !== undefined && after < before) {
        failures.push(
          `CATALOGUE LOST: ${table} had ${before} row(s) before the reset, now has ${after}`,
        );
      }
    }
  } else {
    console.log(
      "  note: snapshot has no catalogueCounts baseline — category/recipe/ingredient\n" +
        "        survival not checked. Confirm by eye against the wipe script's output.\n",
    );
  }

  // --- Report -------------------------------------------------------------
  console.log(`Verifying against snapshot taken ${snapshot.takenAt}\n`);
  console.log(`  stock rows matched:   ${matched} / ${expected.size}`);
  console.log(`  movement reasons:     ${[...byReason, ...ingByReason].map((r) => `${r.reason}=${r._count}`).join(", ") || "none"}`);
  console.log(`  catalogue kept:       ${Object.entries(kept).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log("");

  if (failures.length === 0) {
    console.log("VERIFICATION PASSED — stock matches the pre-wipe position exactly,");
    console.log("transactional history is clear, and every movement is an opening balance.");
    return;
  }

  console.log(`VERIFICATION FAILED — ${failures.length} problem(s):\n`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log("\nDo not trade on these figures. Restore the pg_dump and investigate.");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
