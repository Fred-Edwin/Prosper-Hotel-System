// Replays the pre-wipe stock snapshot as today's opening balance, using the
// real module logic (recordStockCount + correctStockCount) as the owner —
// so the result is exactly what an owner walking the shelves and counting
// would have produced.
//
// Run AFTER scripts/clear-transactions-keep-catalog.ts, using the snapshot
// taken BEFORE it by scripts/snapshot-stock.ts.
//
// Why "corrected", not "received" (settled in the August load, unchanged):
// receiving mutates lastKnownCostMinor via the running-average cost update
// AND feeds sumIngredientsBoughtMinorAtLocationInPeriod, the "bought" term
// in cost-of-goods-sold. Loading a physical count as a purchase would
// fabricate spend the owner never made and distort COGS — including the
// cost basis of every future real sale. A stock-count correction touches
// neither: closing stock quantity sums all movements regardless of reason,
// and closing stock value is a separate downstream multiplication.
//
// How the quantities land correctly: correctStockCount writes a DELTA
// (correctedQuantity - expectedQuantity), not an absolute. Because the wipe
// leaves zero movements, expectedQuantity is 0 for every line, so the delta
// equals the full counted quantity. This is why the snapshot must be taken
// before the wipe and reloaded into an empty movements table — running this
// against a non-empty table would produce deltas, not opening balances.
//
// The canteen's auto-sale path in recordStockCount is inert here for the
// same reason: it books a `sold` movement for a shortfall of
// (expected - counted), which with expected = 0 is negative and filtered
// out by its own `> 0` guard. No phantom sales are created.
//
// Usage: npx tsx scripts/reload-opening-stock.ts --snapshot <path> [--dry-run]

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordStockCount, correctStockCount } from "@/modules/stock/logic";
import type { AuthenticatedStaff } from "@/modules/people/logic";

const dryRun = process.argv.includes("--dry-run");
const snapFlagIndex = process.argv.indexOf("--snapshot");
const snapshotPath = snapFlagIndex !== -1 ? process.argv[snapFlagIndex + 1] : null;
if (!snapshotPath) {
  console.error("Usage: npx tsx scripts/reload-opening-stock.ts --snapshot <path> [--dry-run]");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type Snapshot = {
  takenAt: string;
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

  const owner = await db.staffMember.findFirst({
    where: { role: "owner", active: true },
    include: { location: true },
  });
  if (!owner) throw new Error("No active owner staff member found");
  const requester: AuthenticatedStaff = {
    staff: { ...owner, dailyRateMinor: owner.dailyRateMinor.toNumber() },
    location: owner.location,
  };

  // Guard: this script only produces opening balances against an empty
  // movements table. Against a populated one it would write deltas instead,
  // silently doubling or halving every figure.
  const existingProductMovements = await db.stockMovement.count();
  const existingIngredientMovements = await db.ingredientMovement.count();
  if (!dryRun && (existingProductMovements > 0 || existingIngredientMovements > 0)) {
    console.log(
      `STOP: expected an empty movements table, found ${existingProductMovements} stock ` +
        `movement(s) and ${existingIngredientMovements} ingredient movement(s). ` +
        `correctStockCount writes a delta against current stock — running now would not ` +
        `produce opening balances. Run the wipe first, or restore and start over.`,
    );
    process.exitCode = 1;
    return;
  }

  const locations = await db.location.findMany();
  const locationByCode = new Map(locations.map((l) => [l.code, l]));

  console.log(
    `${dryRun ? "[dry-run] " : ""}Reloading opening stock as ${owner.name} (owner)\n` +
      `  from snapshot taken ${snapshot.takenAt}\n`,
  );

  let recordedLines = 0;
  let failedLines = 0;

  async function loadLines(
    locationCode: string,
    itemType: "product" | "ingredient",
    rows: { itemId: string; name: string; quantityOnHand: number }[],
  ) {
    const location = locationByCode.get(locationCode as "restaurant" | "canteen");
    if (!location) {
      console.log(`  SKIPPING unknown location "${locationCode}"`);
      return;
    }

    // A zero-quantity row produces a zero delta, which writes no movement at
    // all — correct, but it would still occupy a count line for no reason.
    const lines = rows.filter((r) => r.quantityOnHand !== 0);
    if (lines.length === 0) {
      console.log(`--- ${locationCode} / ${itemType}: nothing to load ---`);
      return;
    }

    console.log(`--- ${locationCode} / ${itemType}: ${lines.length} line(s) ---`);

    if (dryRun) {
      for (const line of lines) {
        console.log(`  [dry-run] ${line.name} -> ${line.quantityOnHand}`);
      }
      return;
    }

    const countResult = await recordStockCount(db, requester, {
      locationId: location.id,
      lines: lines.map((l) => ({
        itemType,
        itemId: l.itemId,
        countedQuantity: l.quantityOnHand,
      })),
    });
    if (!countResult.ok) {
      console.log(`  FAILED to record count: ${countResult.reason}`);
      failedLines += lines.length;
      return;
    }
    console.log(`  recorded count ${countResult.count.id}`);

    for (const line of countResult.count.lines) {
      const correction = await correctStockCount(db, requester, {
        stockCountId: countResult.count.id,
        lineId: line.id,
        correctedQuantity: line.countedQuantity,
      });
      const name = lines.find((l) => l.itemId === line.itemId)?.name ?? line.itemId;
      if (!correction.ok) {
        console.log(`    FAILED ${name}: ${correction.reason}`);
        failedLines++;
      } else {
        console.log(`    ${name} -> ${line.countedQuantity}`);
        recordedLines++;
      }
    }
  }

  const locationCodes = [...new Set(snapshot.items.map((i) => i.locationCode))].sort();
  for (const code of locationCodes) {
    await loadLines(
      code,
      "product",
      snapshot.items
        .filter((i) => i.locationCode === code)
        .map((i) => ({ itemId: i.productId, name: i.name, quantityOnHand: i.quantityOnHand })),
    );
  }

  const ingredientLocationCodes = [
    ...new Set(snapshot.ingredients.map((i) => i.locationCode)),
  ].sort();
  for (const code of ingredientLocationCodes) {
    await loadLines(
      code,
      "ingredient",
      snapshot.ingredients
        .filter((i) => i.locationCode === code)
        .map((i) => ({
          itemId: i.ingredientId,
          name: i.name,
          quantityOnHand: i.quantityOnHand,
        })),
    );
  }

  console.log(`\n${dryRun ? "(dry run — nothing was written)" : `Done. ${recordedLines} line(s) reloaded, ${failedLines} failed.`}`);
  if (!dryRun) {
    console.log("Run scripts/verify-reset.ts next to confirm the figures match the snapshot.");
    if (failedLines > 0) {
      console.log(`\nWARNING: ${failedLines} line(s) failed — those items are at 0. Investigate before trading.`);
      process.exitCode = 1;
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
