// Step 2 of the trading-data reset (docs/data-reset-findings.md).
//
// READ-ONLY. Writes nothing. Produces two artifacts on the laptop:
//
//   scripts/reset/snapshot-<timestamp>.json  — machine-readable, fed to
//                                              the replay and the verify
//   scripts/reset/sheet-<timestamp>.txt      — the owner's sign-off sheet
//
// Stock is not stored anywhere: a level is the SUM of StockMovement rows
// (findings Trap 1). After the wipe, that JSON and the pg_dump are the only
// records of the position — which is why this runs, and is signed off,
// before anything destructive.
//
// It also runs the full preflight (findings step 4) while aborting is still
// free. Three classes of problem silently reload as zero or fail a whole
// location's count:
//
//   no cost basis     -> correctStockCount returns invalid_cost, the item's
//                        correction never lands, item reloads at ZERO
//   inactive w/ stock -> recordStockCount rejects the ENTIRE location's
//                        count for one bad line (Trap 3, the "Smokies" case)
//   negative quantity -> recordStockCount returns invalid_quantity, again
//                        failing the whole batch
//
// Exits non-zero if any are found, and prints the exact catalogue edits
// that would clear them.
//
// --zero-out <name>  accepts an item reloading at zero, by name. Recorded on
//                    the snapshot and printed on the sheet, so it is a
//                    decision the owner signs off rather than a silent
//                    exclusion. Used on 2026-08-17 for "Mandazi (15)", whose
//                    -5 was a double-count: 271 received, all 271 booked sold
//                    by a stock count, then 5 booked consumed twelve minutes
//                    later against stock the count had already zeroed. The
//                    five were already inside the 271; the real shelf was
//                    empty. Repeatable for several items.
//
// Usage: npx tsx scripts/reset-snapshot.ts [--zero-out "<item name>"]...

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getCurrentRecipe } from "@/modules/catalogue/index";
import { resolveProductCostBasis } from "@/modules/stock/index";

// Item names the operator has explicitly accepted reloading at zero.
const zeroOut = process.argv.reduce<string[]>((acc, arg, i) => {
  if (arg === "--zero-out" && process.argv[i + 1]) acc.push(process.argv[i + 1]);
  return acc;
}, []);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const OUT_DIR = "scripts/reset";

export type SnapshotLine = {
  itemType: "product" | "ingredient";
  itemId: string;
  name: string;
  locationCode: string;
  locationId: string;
  quantityOnHand: number;
  active: boolean;
  /** Null when the item has no resolvable cost basis — it would reload at
   *  zero. Recorded so verify can explain a missing line rather than just
   *  reporting a mismatch. */
  costBasisMinor: number | null;
};

export type Snapshot = {
  takenAt: string;
  databaseHost: string;
  lines: SnapshotLine[];
  /** Items deliberately accepted as reloading at zero, by name — see
   *  --zero-out. Excluded from the replay and from verify's expectations. */
  zeroedOut: string[];
  /** Asserted zero by the wipe, per the owner's 2026-08-17 decision. */
  assertions: { assets: number; daysWorked: number };
  transactionalCounts: Record<string, number>;
  /** Catalogue/identity row counts before the wipe. Verify compares against
   *  these rather than asserting non-zero — this database legitimately has
   *  no recipes, and "unchanged" is the real requirement anyway. */
  keptCounts: Record<string, number>;
};

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/** The connection host, without the password — recorded on the snapshot so
 *  a sheet can never be mistaken for one taken against a different DB. */
function safeDbHost(): string {
  const url = process.env.DATABASE_URL ?? "";
  return url.replace(/\/\/[^@]*@/, "//<redacted>@");
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — see the findings doc's environment section");
  }

  const locations = await db.location.findMany();

  const products = await db.product.findMany();
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredients = await db.ingredient.findMany();
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const lines: SnapshotLine[] = [];

  // Products: derived per location, exactly as getCurrentStockAtLocation
  // reads them (stock/queries.ts sumMovementsByProductAtLocation).
  for (const location of locations) {
    const sums = await db.stockMovement.groupBy({
      by: ["productId"],
      where: { locationId: location.id },
      _sum: { quantity: true },
    });

    for (const sum of sums) {
      const product = productById.get(sum.productId);
      if (!product) {
        throw new Error(`StockMovement references unknown product ${sum.productId}`);
      }
      const quantityOnHand = sum._sum.quantity?.toNumber() ?? 0;

      // Same three-tier resolution correctStockCount will apply on replay
      // (formulas.md §4) — computed here so preflight sees what the replay
      // will see, not an approximation of it.
      const recipe =
        product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
      const basis = resolveProductCostBasis(
        {
          priceMinor: product.priceMinor?.toNumber() ?? null,
          lastKnownCostMinor: product.lastKnownCostMinor?.toNumber() ?? null,
        },
        recipe,
      );

      lines.push({
        itemType: "product",
        itemId: product.id,
        name: product.name,
        locationCode: location.code,
        locationId: location.id,
        quantityOnHand,
        active: product.active,
        costBasisMinor: basis?.costBasisMinor ?? null,
      });
    }
  }

  // Ingredients: same derivation via IngredientMovement. Valued at
  // lastKnownCostMinor only — ingredients have no selling price, so
  // correctStockCount's ingredient branch has no estimate tier to fall back
  // on. A null cost is therefore fatal in a way a product's is not.
  for (const location of locations) {
    const sums = await db.ingredientMovement.groupBy({
      by: ["ingredientId"],
      where: { locationId: location.id },
      _sum: { quantity: true },
    });

    for (const sum of sums) {
      const ingredient = ingredientById.get(sum.ingredientId);
      if (!ingredient) {
        throw new Error(`IngredientMovement references unknown ingredient ${sum.ingredientId}`);
      }
      lines.push({
        itemType: "ingredient",
        itemId: ingredient.id,
        name: ingredient.name,
        locationCode: location.code,
        locationId: location.id,
        quantityOnHand: sum._sum.quantity?.toNumber() ?? 0,
        active: ingredient.active,
        costBasisMinor: ingredient.lastKnownCostMinor?.toNumber() ?? null,
      });
    }
  }

  const assertions = {
    assets: await db.asset.count(),
    daysWorked: await db.daysWorked.count(),
  };

  const transactionalCounts = {
    drawingRepayment: await db.drawingRepayment.count(),
    drawingDebt: await db.drawingDebt.count(),
    asset: assertions.assets,
    expense: await db.expense.count(),
    handover: await db.handover.count(),
    daysWorked: assertions.daysWorked,
    paymentLine: await db.paymentLine.count(),
    saleLine: await db.saleLine.count(),
    sale: await db.sale.count(),
    repayment: await db.repayment.count(),
    customer: await db.customer.count(),
    stockCountLine: await db.stockCountLine.count(),
    stockCount: await db.stockCount.count(),
    transfer: await db.transfer.count(),
    stockMovement: await db.stockMovement.count(),
    ingredientMovement: await db.ingredientMovement.count(),
  };

  const keptCounts = {
    product: await db.product.count(),
    category: await db.category.count(),
    ingredient: await db.ingredient.count(),
    recipe: await db.recipe.count(),
    recipeLine: await db.recipeLine.count(),
    staffMember: await db.staffMember.count(),
    location: await db.location.count(),
  };

  const snapshot: Snapshot = {
    takenAt: new Date().toISOString(),
    databaseHost: safeDbHost(),
    lines,
    zeroedOut: zeroOut,
    assertions,
    transactionalCounts,
    keptCounts,
  };

  // --- Preflight -----------------------------------------------------

  // Only items actually holding stock matter. An item at zero has nothing
  // to reload, so a missing price on it is harmless here.
  const allHolding = lines.filter((l) => l.quantityOnHand !== 0);

  // An accepted-at-zero item is excluded from the replay entirely, so its
  // cost basis and sign stop mattering — but say so out loud rather than
  // letting it vanish from the report.
  const accepted = allHolding.filter((l) => zeroOut.includes(l.name));
  const holding = allHolding.filter((l) => !zeroOut.includes(l.name));

  const unmatchedZeroOut = zeroOut.filter((name) => !lines.some((l) => l.name === name));

  const noCostBasis = holding.filter((l) => l.costBasisMinor == null);
  const inactiveWithStock = holding.filter((l) => !l.active);
  const negative = holding.filter((l) => l.quantityOnHand < 0);

  console.log("=== PREFLIGHT ===\n");
  console.log(`items holding non-zero stock: ${allHolding.length}`);
  console.log(`  accepted as reloading at 0: ${accepted.length}`);
  console.log(`  to be replayed:             ${holding.length}`);
  console.log(`  no resolvable cost basis:   ${noCostBasis.length}`);
  console.log(`  inactive but holding stock: ${inactiveWithStock.length}`);
  console.log(`  negative quantity:          ${negative.length}\n`);

  if (accepted.length > 0) {
    console.log("--- ACCEPTED AS RELOADING AT ZERO (--zero-out) ---");
    for (const l of accepted) {
      console.log(`  ${pad(l.name, 40)} ${pad(l.locationCode, 11)} qty ${l.quantityOnHand} -> 0`);
    }
    console.log("");
  }

  // A typo in --zero-out would silently fail to exclude anything, letting a
  // negative through to a replay that rejects the whole location's count.
  if (unmatchedZeroOut.length > 0) {
    console.log("ABORT: --zero-out named items that do not exist:");
    for (const name of unmatchedZeroOut) console.log(`  "${name}"`);
    console.log("\nCheck the spelling against the catalogue. Nothing written.");
    process.exitCode = 1;
    return;
  }

  const fixes: string[] = [];

  if (noCostBasis.length > 0) {
    console.log("--- NO COST BASIS (would reload at ZERO) ---");
    for (const l of noCostBasis) {
      console.log(`  ${pad(l.name, 40)} ${pad(l.locationCode, 11)} qty ${l.quantityOnHand}`);
      fixes.push(
        l.itemType === "product"
          ? `set a selling price (or lastKnownCostMinor) on product "${l.name}"`
          : `set lastKnownCostMinor on ingredient "${l.name}"`,
      );
    }
    console.log("");
  }

  if (inactiveWithStock.length > 0) {
    console.log("--- INACTIVE BUT HOLDING STOCK (fails the whole location's count) ---");
    for (const l of inactiveWithStock) {
      console.log(`  ${pad(l.name, 40)} ${pad(l.locationCode, 11)} qty ${l.quantityOnHand}`);
      fixes.push(
        `reactivate ${l.itemType} "${l.name}", or accept it reloading at zero and let its stock go`,
      );
    }
    console.log("");
  }

  if (negative.length > 0) {
    console.log("--- NEGATIVE QUANTITY (recordStockCount rejects the batch) ---");
    for (const l of negative) {
      console.log(`  ${pad(l.name, 40)} ${pad(l.locationCode, 11)} qty ${l.quantityOnHand}`);
      fixes.push(
        `decide the true quantity for ${l.itemType} "${l.name}" — a negative cannot be replayed`,
      );
    }
    console.log("");
  }

  const blocked = noCostBasis.length + inactiveWithStock.length + negative.length;

  if (blocked > 0) {
    console.log("=== FIX PLAN ===\n");
    for (const [i, fix] of fixes.entries()) console.log(`  ${i + 1}. ${fix}`);
    console.log("");
    console.log("Aborting — nothing written. Fix the above and re-run, or accept");
    console.log('an item reloading at zero with --zero-out "<item name>".');
    process.exitCode = 1;
    return;
  } else {
    console.log("Preflight clean.\n");
  }

  // --- Artifacts -----------------------------------------------------

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestamp();
  const jsonPath = path.join(OUT_DIR, `snapshot-${stamp}.json`);
  const sheetPath = path.join(OUT_DIR, `sheet-${stamp}.txt`);

  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2));

  const sheet: string[] = [];
  sheet.push("PROSPER HOTEL — STOCK POSITION BEFORE RESET");
  sheet.push(`Taken: ${snapshot.takenAt}`);
  sheet.push(`Database: ${snapshot.databaseHost}`);
  sheet.push("");
  sheet.push("After the wipe, this sheet and the pg_dump are the only record");
  sheet.push("of these figures. Check them before confirming.");
  sheet.push("");

  for (const location of locations) {
    for (const itemType of ["product", "ingredient"] as const) {
      const group = lines
        .filter(
          (l) => l.locationId === location.id && l.itemType === itemType && l.quantityOnHand !== 0,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      if (group.length === 0) continue;

      sheet.push(`--- ${location.name} (${location.code}) — ${itemType}s ---`);
      sheet.push(`${pad("ITEM", 44)}${padLeft("QTY", 10)}`);
      for (const l of group) {
        const flag = !l.active ? "  [INACTIVE]" : l.costBasisMinor == null ? "  [NO COST]" : "";
        sheet.push(`${pad(l.name, 44)}${padLeft(String(l.quantityOnHand), 10)}${flag}`);
      }
      sheet.push(`${pad("", 44)}${padLeft(`${group.length} items`, 10)}`);
      sheet.push("");
    }
  }

  if (accepted.length > 0) {
    sheet.push("--- DELIBERATELY RELOADING AT ZERO ---");
    sheet.push("These read a stale figure today and will read 0 after the reset.");
    for (const l of accepted) {
      sheet.push(`${pad(l.name, 44)}${padLeft(String(l.quantityOnHand), 10)}  ->  0`);
    }
    sheet.push("");
  }

  sheet.push("--- rows to be deleted ---");
  for (const [table, count] of Object.entries(transactionalCounts)) {
    sheet.push(`  ${pad(table, 24)}${padLeft(String(count), 8)}`);
  }
  sheet.push("");
  sheet.push(`Assets recorded:      ${assertions.assets}  (owner says: must be 0)`);
  sheet.push(`Days-worked recorded: ${assertions.daysWorked}  (owner says: must be 0)`);
  sheet.push("");

  fs.writeFileSync(sheetPath, sheet.join("\n"));

  console.log(`snapshot: ${jsonPath}`);
  console.log(`sheet:    ${sheetPath}`);
  console.log(`\n${lines.filter((l) => l.quantityOnHand !== 0).length} items holding stock.`);
  console.log("\nSTOP HERE. The owner must confirm the sheet before anything is deleted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
