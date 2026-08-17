// Step 7 of the trading-data reset (docs/data-reset-findings.md).
//
// READ-ONLY. Compares the post-reset position against the pre-reset snapshot
// line by line, and confirms the transactional tables are actually empty.
//
// Checks three things the reset could plausibly get wrong:
//
//   quantities   every snapshot item reads its snapshot figure back, and no
//                item that was absent has appeared
//   dates        every movement sits at yesterday's close, not today — the
//                Trap 2 failure is invisible in the quantities alone but
//                wrecks the day's cost-of-goods-sold
//   emptiness    sales, expenses, handovers, transfers and customers are
//                gone, and the only movements present are the replay's
//                own `corrected` rows
//
// Usage: npx tsx scripts/reset-verify.ts --snapshot <file>

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Snapshot } from "./reset-snapshot";

const args = process.argv.slice(2);
const snapshotPath = args[args.indexOf("--snapshot") + 1];

const REPLAY_AT = new Date("2026-08-16T23:59:00");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

async function main() {
  if (!snapshotPath || snapshotPath.startsWith("--")) {
    throw new Error("--snapshot <file> is required");
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8")) as Snapshot;

  const locations = await db.location.findMany();
  const failures: string[] = [];

  // --- Quantities -----------------------------------------------------
  console.log("=== QUANTITIES ===\n");

  for (const location of locations) {
    const productSums = await db.stockMovement.groupBy({
      by: ["productId"],
      where: { locationId: location.id },
      _sum: { quantity: true },
    });
    const ingredientSums = await db.ingredientMovement.groupBy({
      by: ["ingredientId"],
      where: { locationId: location.id },
      _sum: { quantity: true },
    });

    const live = new Map<string, number>();
    for (const s of productSums) live.set(`product:${s.productId}`, s._sum.quantity?.toNumber() ?? 0);
    for (const s of ingredientSums) {
      live.set(`ingredient:${s.ingredientId}`, s._sum.quantity?.toNumber() ?? 0);
    }

    // Zeroed-out items are expected to be absent, not to match their old
    // figure — verifying them against the snapshot would fail by design.
    const expected = snapshot.lines.filter(
      (l) =>
        l.locationId === location.id &&
        l.quantityOnHand !== 0 &&
        !snapshot.zeroedOut.includes(l.name),
    );
    const zeroed = snapshot.lines.filter(
      (l) => l.locationId === location.id && snapshot.zeroedOut.includes(l.name),
    );
    if (expected.length === 0 && zeroed.length === 0) continue;

    console.log(`--- ${location.name} (${location.code}) ---`);
    console.log(`${pad("ITEM", 40)}${padLeft("WAS", 9)}${padLeft("NOW", 9)}   STATUS`);

    for (const l of zeroed) {
      const now = live.get(`${l.itemType}:${l.itemId}`) ?? 0;
      if (now !== 0) {
        failures.push(`${l.name} @ ${l.locationCode}: accepted as zero but reads ${now}`);
      }
      console.log(
        `${pad(l.name, 40)}${padLeft(String(l.quantityOnHand), 9)}` +
          `${padLeft(String(now), 9)}   ${now === 0 ? "zeroed ok" : "SHOULD BE 0"}`,
      );
      live.delete(`${l.itemType}:${l.itemId}`);
    }

    for (const line of expected.sort((a, b) => a.name.localeCompare(b.name))) {
      const key = `${line.itemType}:${line.itemId}`;
      const now = live.get(key) ?? 0;
      const ok = now === line.quantityOnHand;
      if (!ok) {
        failures.push(
          `${line.name} @ ${line.locationCode}: expected ${line.quantityOnHand}, got ${now}`,
        );
      }
      console.log(
        `${pad(line.name, 40)}${padLeft(String(line.quantityOnHand), 9)}` +
          `${padLeft(String(now), 9)}   ${ok ? "ok" : "MISMATCH"}`,
      );
      live.delete(key);
    }

    // Anything left over appeared from nowhere.
    for (const [key, qty] of live) {
      if (qty !== 0) {
        failures.push(`${key} @ ${location.code}: unexpected stock ${qty} (not in snapshot)`);
        console.log(`${pad(key, 40)}${padLeft("-", 9)}${padLeft(String(qty), 9)}   UNEXPECTED`);
      }
    }
    console.log("");
  }

  // --- Dates ----------------------------------------------------------
  console.log("=== DATES ===\n");

  const misdatedProducts = await db.stockMovement.count({
    where: { occurredAt: { not: REPLAY_AT } },
  });
  const misdatedIngredients = await db.ingredientMovement.count({
    where: { occurredAt: { not: REPLAY_AT } },
  });
  if (misdatedProducts !== 0 || misdatedIngredients !== 0) {
    failures.push(
      `${misdatedProducts} product and ${misdatedIngredients} ingredient movements are not ` +
        `dated ${REPLAY_AT.toISOString()} — today's COGS will be wrong (findings Trap 2)`,
    );
  }
  console.log(`movements not at ${REPLAY_AT.toISOString()}: ${misdatedProducts + misdatedIngredients}`);

  // --- Emptiness ------------------------------------------------------
  console.log("\n=== TRANSACTIONAL TABLES ===\n");

  const mustBeEmpty: Record<string, number> = {
    sale: await db.sale.count(),
    saleLine: await db.saleLine.count(),
    paymentLine: await db.paymentLine.count(),
    expense: await db.expense.count(),
    handover: await db.handover.count(),
    transfer: await db.transfer.count(),
    customer: await db.customer.count(),
    repayment: await db.repayment.count(),
    drawingDebt: await db.drawingDebt.count(),
    drawingRepayment: await db.drawingRepayment.count(),
    asset: await db.asset.count(),
    daysWorked: await db.daysWorked.count(),
  };

  for (const [table, count] of Object.entries(mustBeEmpty)) {
    const ok = count === 0;
    if (!ok) failures.push(`${table} still has ${count} rows`);
    console.log(`  ${pad(table, 22)}${padLeft(String(count), 6)}   ${ok ? "empty" : "NOT EMPTY"}`);
  }

  // The replay writes `corrected` rows only. Anything else means either the
  // wipe missed something or the canteen shortfall path fired.
  const byReason = await db.stockMovement.groupBy({ by: ["reason"], _count: true });
  console.log("\n  stock movements by reason:");
  for (const r of byReason) {
    const ok = r.reason === "corrected";
    if (!ok) failures.push(`unexpected '${r.reason}' movements: ${r._count}`);
    console.log(`    ${pad(r.reason, 20)}${padLeft(String(r._count), 6)}   ${ok ? "ok" : "UNEXPECTED"}`);
  }

  // --- Catalogue survived ---------------------------------------------
  console.log("\n=== CATALOGUE (must be untouched) ===\n");
  const kept = {
    product: await db.product.count(),
    category: await db.category.count(),
    ingredient: await db.ingredient.count(),
    recipe: await db.recipe.count(),
    recipeLine: await db.recipeLine.count(),
    staffMember: await db.staffMember.count(),
    location: await db.location.count(),
  };
  // Compared against the pre-reset counts, not asserted non-zero: this
  // database legitimately has no recipes, and the requirement is that the
  // catalogue is *unchanged*, which a fixed ">0" rule does not express.
  for (const [table, count] of Object.entries(kept)) {
    const before = snapshot.keptCounts?.[table];
    const ok = before === undefined ? count > 0 : count === before;
    if (!ok) {
      failures.push(
        before === undefined
          ? `${table} is empty — catalogue was destroyed`
          : `${table} was ${before} before the reset, now ${count}`,
      );
    }
    const detail = before === undefined ? "" : ` (was ${before})`;
    console.log(
      `  ${pad(table, 22)}${padLeft(String(count), 6)}${pad(detail, 12)}   ${ok ? "ok" : "CHANGED!"}`,
    );
  }

  // --- Verdict ---------------------------------------------------------
  console.log("");
  if (failures.length > 0) {
    console.log(`=== ${failures.length} FAILURE(S) ===\n`);
    for (const f of failures) console.log(`  ${f}`);
    console.log("\nDO NOT let anyone trade. The pg_dump is the undo.");
    process.exitCode = 1;
    return;
  }

  console.log("=== VERIFIED ===\n");
  console.log("Every figure matches the snapshot, all movements dated");
  console.log(`${REPLAY_AT.toISOString()}, transactional tables empty,`);
  console.log("catalogue intact. Check the live ledger, then trading can resume.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
