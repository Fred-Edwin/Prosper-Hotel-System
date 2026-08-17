// Steps 5 and 6 of the trading-data reset (docs/data-reset-findings.md),
// deliberately in ONE script: between the wipe and the replay every item in
// the business reads zero. There is no safe place to pause in the middle,
// so there is no way to invoke one half without the other.
//
// What it does:
//   1. re-validates the snapshot against live data (nothing traded since)
//   2. asserts assets = 0 and days-worked = 0 (owner's 2026-08-17 decision)
//   3. re-runs preflight — a wipe with a bad item still in place loses stock
//   4. deletes every transactional table, children before parents
//   5. replays each location's position as an owner stock count + correction
//   6. re-stamps every replayed movement to yesterday's close
//   7. asserts no phantom sales were written
//
// Steps 4-7 run inside a single db.$transaction. A partial wipe leaves the
// books in a state that is neither the old position nor a clean one.
//
// WHY A COUNT CORRECTION, NOT A RECEIPT (findings Trap 5): receiving mutates
// lastKnownCostMinor via the running-average update AND feeds the "bought"
// term in cost-of-goods-sold. Loading a physical count as a purchase
// fabricates spend the owner never made. A correction touches neither.
//
// WHY YESTERDAY (findings Trap 2): reporting periods filter
// `occurredAt > periodStart AND <= periodEnd`; opening stock is
// `occurredAt <= asOf`. A movement dated yesterday evening therefore falls
// OUTSIDE today's period but INSIDE today's opening balance — today opens at
// the counted figure and, with no trading yet, closes at the same figure.
// Dating it today instead gives opening=0 plus a correction inside the
// period, which makes formulas.md §6 produce a large negative COGS. That
// already happened on 2026-08-14 and forced the workaround still sitting in
// src/modules/reporting/ui/opening-balance.ts.
//
// Usage:
//   npx tsx scripts/reset-wipe-and-replay.ts --snapshot <file> --dry-run
//   npx tsx scripts/reset-wipe-and-replay.ts --snapshot <file> --i-have-the-snapshot

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordStockCount, correctStockCount } from "@/modules/stock/index";
import type { AuthenticatedStaff } from "@/modules/people/index";
// Cost basis is read off the snapshot rather than recomputed here — the
// snapshot's figure is what preflight was signed off against.
import type { Snapshot } from "./reset-snapshot";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--i-have-the-snapshot");
const snapshotPath = args[args.indexOf("--snapshot") + 1];

// findings Trap 2: yesterday's close, not now. recordStockCount and
// correctStockCount do not accept an occurredAt — they default to now() —
// so the rows are re-stamped after creation rather than threading a date
// through live business logic for a one-off.
const REPLAY_AT = new Date("2026-08-16T23:59:00");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!snapshotPath || snapshotPath.startsWith("--")) {
    throw new Error("--snapshot <file> is required (produced by reset-snapshot.ts)");
  }
  if (!dryRun && !confirmed) {
    throw new Error(
      "Refusing to run destructively without --i-have-the-snapshot.\n" +
        "The owner must have confirmed the sign-off sheet first.",
    );
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8")) as Snapshot;
  console.log(`snapshot taken ${snapshot.takenAt} against ${snapshot.databaseHost}`);
  console.log(`${snapshot.lines.length} snapshot lines\n`);

  const owner = await db.staffMember.findFirst({
    where: { role: "owner", active: true },
    include: { location: true },
  });
  if (!owner) throw new Error("No active owner staff member found");
  const requester: AuthenticatedStaff = {
    staff: { ...owner, dailyRateMinor: owner.dailyRateMinor.toNumber() },
    location: owner.location,
  };

  const locations = await db.location.findMany();

  // --- Guard 1: nothing has traded since the snapshot -----------------
  //
  // The owner is waiting rather than trading, but a stale snapshot would
  // silently reload yesterday's figures over today's — so verify rather
  // than trust.
  console.log("=== RE-VALIDATING SNAPSHOT AGAINST LIVE DATA ===\n");
  const drift: string[] = [];
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
    for (const s of productSums) {
      live.set(`product:${s.productId}`, s._sum.quantity?.toNumber() ?? 0);
    }
    for (const s of ingredientSums) {
      live.set(`ingredient:${s.ingredientId}`, s._sum.quantity?.toNumber() ?? 0);
    }

    const snapshotHere = snapshot.lines.filter((l) => l.locationId === location.id);
    for (const line of snapshotHere) {
      const key = `${line.itemType}:${line.itemId}`;
      const liveQty = live.get(key) ?? 0;
      if (liveQty !== line.quantityOnHand) {
        drift.push(
          `${line.name} @ ${line.locationCode}: snapshot ${line.quantityOnHand}, live ${liveQty}`,
        );
      }
      live.delete(key);
    }
    for (const [key, qty] of live) {
      if (qty !== 0) drift.push(`${key} @ ${location.code}: absent from snapshot, live ${qty}`);
    }
  }

  if (drift.length > 0) {
    console.log("SNAPSHOT IS STALE — the database has moved since it was taken:\n");
    for (const d of drift) console.log(`  ${d}`);
    console.log("\nAborting. Re-run reset-snapshot.ts and get the sheet re-confirmed.");
    process.exitCode = 1;
    return;
  }
  console.log("Snapshot matches live data exactly.\n");

  // --- Guard 2: owner's assertions ------------------------------------
  const assetCount = await db.asset.count();
  const daysWorkedCount = await db.daysWorked.count();
  if (assetCount !== 0 || daysWorkedCount !== 0) {
    console.log(
      `ABORT: owner stated no assets and no days-worked were ever recorded,\n` +
        `but found assets=${assetCount}, daysWorked=${daysWorkedCount}.\n` +
        `These would be destroyed. Confirm with the owner before proceeding.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log("Assertions hold: assets=0, daysWorked=0.\n");

  // --- Guard 3: preflight, again --------------------------------------
  //
  // reset-snapshot.ts can be overridden with --accept-preflight. This gate
  // cannot: past this point a bad item's stock is gone for good.
  // Items the owner accepted as reloading at zero are excluded from the
  // replay entirely — they simply get no movement, which is how an item
  // holding nothing is represented (findings: a genuinely uncounted item
  // keeps no StockMovement, not a fabricated zero one).
  const holding = snapshot.lines.filter(
    (l) => l.quantityOnHand !== 0 && !snapshot.zeroedOut.includes(l.name),
  );
  if (snapshot.zeroedOut.length > 0) {
    console.log(`accepted as reloading at zero: ${snapshot.zeroedOut.join(", ")}\n`);
  }
  const bad = holding.filter((l) => l.costBasisMinor == null || !l.active || l.quantityOnHand < 0);
  if (bad.length > 0) {
    console.log("ABORT: preflight failures still present:\n");
    for (const l of bad) {
      const why =
        l.quantityOnHand < 0 ? "negative" : !l.active ? "inactive" : "no cost basis";
      console.log(`  ${pad(l.name, 40)} ${pad(l.locationCode, 11)} ${why}`);
    }
    console.log("\nFix the catalogue and re-snapshot. Nothing written.");
    process.exitCode = 1;
    return;
  }
  console.log(`Preflight clean — ${holding.length} items will be replayed.\n`);

  // --- Dry run --------------------------------------------------------
  if (dryRun) {
    console.log("=== DRY RUN — would delete ===\n");
    for (const [table, count] of Object.entries(snapshot.transactionalCounts)) {
      const liveCount = await countTable(table);
      console.log(`  ${pad(table, 24)} snapshot ${pad(String(count), 8)} live ${liveCount}`);
    }
    console.log("\n=== would replay ===\n");
    for (const location of locations) {
      for (const itemType of ["product", "ingredient"] as const) {
        const group = holding.filter(
          (l) => l.locationId === location.id && l.itemType === itemType,
        );
        if (group.length > 0) {
          console.log(`  ${location.code} ${itemType}s: ${group.length} lines`);
        }
      }
    }
    console.log(`\n  all movements stamped ${REPLAY_AT.toISOString()}`);
    console.log("\n(dry run — nothing was written)");
    return;
  }

  // --- The real thing -------------------------------------------------
  console.log("=== WIPE + REPLAY (one transaction) ===\n");

  await db.$transaction(
    async (tx) => {
      // Delete order follows foreign keys, children before parents.
      // Asset references Expense (nullable FK) so it goes first; Customer is
      // referenced by PaymentLine/Sale/Repayment so it goes after those.
      console.log("deleting...");
      const deleted: Record<string, number> = {};
      deleted.drawingRepayment = (await tx.drawingRepayment.deleteMany({})).count;
      deleted.drawingDebt = (await tx.drawingDebt.deleteMany({})).count;
      deleted.asset = (await tx.asset.deleteMany({})).count;
      deleted.expense = (await tx.expense.deleteMany({})).count;
      deleted.handover = (await tx.handover.deleteMany({})).count;
      deleted.daysWorked = (await tx.daysWorked.deleteMany({})).count;
      deleted.paymentLine = (await tx.paymentLine.deleteMany({})).count;
      deleted.saleLine = (await tx.saleLine.deleteMany({})).count;
      deleted.sale = (await tx.sale.deleteMany({})).count;
      deleted.repayment = (await tx.repayment.deleteMany({})).count;
      deleted.customer = (await tx.customer.deleteMany({})).count;
      deleted.stockCountLine = (await tx.stockCountLine.deleteMany({})).count;
      deleted.stockCount = (await tx.stockCount.deleteMany({})).count;
      deleted.transfer = (await tx.transfer.deleteMany({})).count;
      deleted.stockMovement = (await tx.stockMovement.deleteMany({})).count;
      deleted.ingredientMovement = (await tx.ingredientMovement.deleteMany({})).count;

      for (const [table, count] of Object.entries(deleted)) {
        console.log(`  ${pad(table, 24)} ${count}`);
      }

      // findings Trap 4: correctStockCount writes a DELTA
      // (correctedQuantity − expectedQuantity), which only equals the full
      // counted quantity when the movements table is empty. Replaying
      // against a non-empty table silently doubles or halves every figure.
      const remainingProduct = await tx.stockMovement.count();
      const remainingIngredient = await tx.ingredientMovement.count();
      if (remainingProduct !== 0 || remainingIngredient !== 0) {
        throw new Error(
          `movements table not empty after wipe (${remainingProduct}/${remainingIngredient}) — ` +
            `replaying now would write deltas, not opening balances`,
        );
      }
      console.log("\nmovements tables empty — safe to replay.\n");

      console.log("replaying...");
      const client = tx as unknown as PrismaClient;

      for (const location of locations) {
        for (const itemType of ["product", "ingredient"] as const) {
          const group = holding.filter(
            (l) => l.locationId === location.id && l.itemType === itemType,
          );
          if (group.length === 0) continue;

          const countResult = await recordStockCount(client, requester, {
            locationId: location.id,
            lines: group.map((l) => ({
              itemType: l.itemType,
              itemId: l.itemId,
              countedQuantity: l.quantityOnHand,
            })),
          });
          if (!countResult.ok) {
            throw new Error(
              `recordStockCount failed for ${location.code} ${itemType}s: ${countResult.reason}`,
            );
          }
          console.log(`  ${location.code} ${itemType}s: count ${countResult.count.id}`);

          const nameById = new Map(group.map((l) => [l.itemId, l.name]));
          for (const line of countResult.count.lines) {
            const correction = await correctStockCount(client, requester, {
              stockCountId: countResult.count.id,
              lineId: line.id,
              correctedQuantity: line.countedQuantity,
            });
            if (!correction.ok) {
              // Unlike the August load, which logged and continued, this
              // aborts the whole transaction — a dropped correction means
              // that item silently reloads at zero.
              throw new Error(
                `correction failed for "${nameById.get(line.itemId)}" ` +
                  `@ ${location.code}: ${correction.reason}`,
              );
            }
          }
          console.log(`    ${countResult.count.lines.length} lines corrected`);
        }
      }

      // findings Trap 2. Re-stamped inside the transaction rather than as a
      // follow-up pass, so the data is never briefly wrong.
      const stampedMovements = await tx.stockMovement.updateMany({
        data: { occurredAt: REPLAY_AT },
      });
      const stampedIngredients = await tx.ingredientMovement.updateMany({
        data: { occurredAt: REPLAY_AT },
      });
      const stampedCounts = await tx.stockCount.updateMany({ data: { occurredAt: REPLAY_AT } });
      console.log(
        `\nre-stamped to ${REPLAY_AT.toISOString()}: ` +
          `${stampedMovements.count} movements, ${stampedIngredients.count} ingredient movements, ` +
          `${stampedCounts.count} counts`,
      );

      // recordStockCount auto-books a `sold` movement plus a Sale for a
      // canteen product shortfall. Against an empty movements table
      // expected=0, so every shortfall is negative and filtered by its
      // `> 0` guard — no phantom sales. Asserted rather than assumed.
      const phantomSales = await tx.sale.count();
      const phantomSaleLines = await tx.saleLine.count();
      if (phantomSales !== 0 || phantomSaleLines !== 0) {
        throw new Error(
          `replay wrote ${phantomSales} sales / ${phantomSaleLines} sale lines — ` +
            `the canteen shortfall path fired. Rolling back.`,
        );
      }
      console.log("no phantom sales written.");

      const soldMovements = await tx.stockMovement.count({ where: { reason: "sold" } });
      if (soldMovements !== 0) {
        throw new Error(`replay wrote ${soldMovements} 'sold' movements. Rolling back.`);
      }
      console.log("no 'sold' movements written.");
    },
    { timeout: 600_000, maxWait: 30_000 },
  );

  console.log("\nCommitted. Run reset-verify.ts now.");
}

async function countTable(table: string): Promise<number> {
  const model = (db as unknown as Record<string, { count: () => Promise<number> }>)[table];
  return model ? model.count() : -1;
}

main()
  .catch((e) => {
    console.error("\nFAILED — transaction rolled back if it had started:\n", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
