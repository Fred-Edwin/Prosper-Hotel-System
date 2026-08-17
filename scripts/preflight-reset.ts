// Checks that the 2026-08-17 reset can complete cleanly, BEFORE anything is
// deleted. Run this against the snapshot produced by snapshot-stock.ts.
//
// READ-ONLY. This script never writes to the database.
//
// It exists because the reload path (recordStockCount + correctStockCount)
// silently skips rows it cannot process, and a skipped row means an item
// sitting at zero stock after the reset while everything around it reloaded
// fine. Every such row must be found and resolved while the original
// movements still exist and the operation is still reversible by simply not
// starting.
//
// Three blockers, each a real rejection path in stock/logic.ts:
//
//   1. invalid_cost   — correctStockCount calls resolveProductCostBasis and
//                       returns { ok: false, reason: "invalid_cost" } when a
//                       product has no recipe cost, no lastKnownCostMinor
//                       and no priceMinor. The correction is dropped.
//   2. inactive item  — recordStockCount rejects a whole batch containing an
//                       inactive product or ingredient. One inactive item
//                       holding stock fails the entire location's count, not
//                       just its own line (this is the August "Smokies"
//                       case, which was handled by skipping the line).
//   3. negative stock — a negative derived quantity is a pre-existing data
//                       problem. It would be faithfully reproduced by the
//                       reload, so it is surfaced rather than silently
//                       carried across a reset that is meant to produce a
//                       clean opening position.
//
// Usage: npx tsx scripts/preflight-reset.ts --snapshot <path>

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveProductCostBasis } from "@/modules/stock/logic";
import { getCurrentRecipe } from "@/modules/catalogue";

const snapFlagIndex = process.argv.indexOf("--snapshot");
const snapshotPath = snapFlagIndex !== -1 ? process.argv[snapFlagIndex + 1] : null;
if (!snapshotPath) {
  console.error("Usage: npx tsx scripts/preflight-reset.ts --snapshot <path>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type Snapshot = {
  takenAt: string;
  items: {
    productId: string;
    name: string;
    locationCode: string;
    quantityOnHand: number;
    active: boolean;
  }[];
  ingredients: {
    ingredientId: string;
    name: string;
    locationCode: string;
    quantityOnHand: number;
    active: boolean;
  }[];
};

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath!, "utf-8")) as Snapshot;

  console.log(`Preflight for snapshot taken ${snapshot.takenAt}`);
  console.log(`  ${snapshot.items.length} product rows, ${snapshot.ingredients.length} ingredient rows\n`);

  const blockers: string[] = [];
  const warnings: string[] = [];

  // --- Blocker 1: products with no resolvable cost basis -----------------
  // Checked against the live catalogue rather than the snapshot's cached
  // flag, and including the recipe lookup that correctStockCount itself
  // does, so cooked food costed purely by recipe is not falsely flagged.
  const productIds = [...new Set(snapshot.items.map((i) => i.productId))];
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const id of productIds) {
    const product = productById.get(id);
    if (!product) {
      blockers.push(`MISSING PRODUCT: snapshot references product ${id}, not found in catalogue`);
      continue;
    }
    const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
    const basis = resolveProductCostBasis(
      {
        priceMinor: product.priceMinor?.toNumber() ?? null,
        lastKnownCostMinor: product.lastKnownCostMinor?.toNumber() ?? null,
      },
      recipe,
    );
    if (!basis) {
      blockers.push(
        `NO COST BASIS: "${product.name}" — no recipe cost, no lastKnownCostMinor, no priceMinor. ` +
          `Its correction would be rejected (invalid_cost) and it would reload at 0.`,
      );
    }
  }

  // --- Blocker 2: inactive items holding stock ---------------------------
  // recordStockCount rejects the entire batch, so one of these fails a whole
  // location, not just its own line.
  for (const item of snapshot.items) {
    const product = productById.get(item.productId);
    if (product && !product.active && item.quantityOnHand !== 0) {
      blockers.push(
        `INACTIVE WITH STOCK: product "${product.name}" @ ${item.locationCode} holds ` +
          `${item.quantityOnHand}. recordStockCount rejects a batch containing an inactive item — ` +
          `this would fail the whole ${item.locationCode} count.`,
      );
    }
  }

  const ingredientIds = [...new Set(snapshot.ingredients.map((i) => i.ingredientId))];
  const ingredients = await db.ingredient.findMany({ where: { id: { in: ingredientIds } } });
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  for (const ing of snapshot.ingredients) {
    const ingredient = ingredientById.get(ing.ingredientId);
    if (!ingredient) {
      blockers.push(`MISSING INGREDIENT: snapshot references ${ing.ingredientId}, not in catalogue`);
      continue;
    }
    if (!ingredient.active && ing.quantityOnHand !== 0) {
      blockers.push(
        `INACTIVE WITH STOCK: ingredient "${ingredient.name}" @ ${ing.locationCode} holds ` +
          `${ing.quantityOnHand}. Would fail the whole ingredient count for that location.`,
      );
    }
  }

  // --- Blocker 3: negative derived stock ---------------------------------
  for (const row of [...snapshot.items, ...snapshot.ingredients]) {
    if (row.quantityOnHand < 0) {
      blockers.push(
        `NEGATIVE STOCK: "${row.name}" @ ${row.locationCode} is ${row.quantityOnHand}. ` +
          `A reset should not carry a negative opening position across.`,
      );
    }
  }

  // --- Warnings: not blocking, but the owner should know -----------------
  const zeroRows = [...snapshot.items, ...snapshot.ingredients].filter(
    (r) => r.quantityOnHand === 0,
  );
  if (zeroRows.length > 0) {
    warnings.push(
      `${zeroRows.length} row(s) sit at exactly 0. These reload as no movement at all ` +
        `(delta of 0 writes nothing), which is correct — an item with no stock has no opening entry.`,
    );
  }

  const owner = await db.staffMember.findFirst({ where: { role: "owner", active: true } });
  if (!owner) {
    blockers.push(`NO ACTIVE OWNER: the reload runs as an owner; none found. It cannot proceed.`);
  } else {
    console.log(`Reload will run as: ${owner.name} (owner)\n`);
  }

  // --- Report -------------------------------------------------------------
  if (warnings.length > 0) {
    console.log("WARNINGS (not blocking):");
    for (const w of warnings) console.log(`  - ${w}`);
    console.log("");
  }

  if (blockers.length === 0) {
    console.log("PREFLIGHT PASSED — every row in the snapshot can be reloaded.");
    console.log("READ-ONLY — nothing was written to the database.");
    return;
  }

  console.log(`PREFLIGHT FAILED — ${blockers.length} blocker(s):\n`);
  for (const b of blockers) console.log(`  - ${b}`);
  console.log("\nResolve these BEFORE running the wipe. Nothing has been deleted.");
  console.log("READ-ONLY — nothing was written to the database.");
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
