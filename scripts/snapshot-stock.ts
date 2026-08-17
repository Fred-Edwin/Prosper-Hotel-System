// Reads the CURRENT derived stock on hand for every product (per location)
// and every ingredient, and writes it to a JSON snapshot plus a readable
// text list for the owner to sign off on.
//
// READ-ONLY. This script never writes to the database.
//
// Why this exists: a stock level is not a stored number, it is the sum of
// the movements (see schema.prisma's StockMovement.quantity comment). The
// 2026-08-17 reset deletes all movements, which would take every stock
// level to zero — so the derived figure must be captured BEFORE the wipe
// and replayed afterwards as an opening balance. This file is that capture,
// and it is the only record of the pre-wipe position outside the pg_dump.
//
// The output shape deliberately mirrors
// `scripts/opening balance/v2-closing-stock-2026-08-14.json` (items[] +
// ingredients[]) so reload-opening-stock.ts can consume it with the same
// shape the August loader already proved out.
//
// Unlike that August file, names here are resolved product/ingredient IDs
// from this same database — there is no name-matching step on reload, so
// the location-suffix mapping that file needed does not apply.
//
// Usage: npx tsx scripts/snapshot-stock.ts [--out <path>]

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  sumMovementsByProductAtLocation,
  sumMovementsByIngredientAtLocation,
} from "@/modules/stock/queries";
import { resolveProductCostBasis } from "@/modules/stock/logic";

const outFlagIndex = process.argv.indexOf("--out");
const outPath =
  outFlagIndex !== -1 && process.argv[outFlagIndex + 1]
    ? process.argv[outFlagIndex + 1]
    : `scripts/reset-2026-08-17/stock-snapshot-${new Date().toISOString().slice(0, 10)}.json`;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type ProductRow = {
  productId: string;
  name: string;
  locationCode: string;
  quantityOnHand: number;
  active: boolean;
  // Present so the sign-off sheet can show a value, and so a missing cost
  // basis (which would make the reload's correction fail with invalid_cost)
  // is visible here rather than discovered mid-reload.
  costBasisMinor: number | null;
  hasCostBasis: boolean;
};

type IngredientRow = {
  ingredientId: string;
  name: string;
  locationCode: string;
  quantityOnHand: number;
  active: boolean;
};

async function main() {
  const locations = await db.location.findMany({ orderBy: { code: "asc" } });
  const products = await db.product.findMany();
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredients = await db.ingredient.findMany();
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const items: ProductRow[] = [];
  const ingredientRows: IngredientRow[] = [];

  for (const location of locations) {
    const productSums = await sumMovementsByProductAtLocation(db, location.id);
    for (const sum of productSums) {
      const product = productById.get(sum.productId);
      if (!product) continue;

      // Mirrors the reload path's cost lookup (correctStockCount ->
      // resolveProductCostBasis) so an item that would be rejected there
      // with invalid_cost shows up in this snapshot as hasCostBasis:false.
      // Recipe-costed items are checked properly in the preflight script;
      // here a null recipe is passed because cooked food carrying stock is
      // rare and the preflight is the authoritative gate.
      const basis = resolveProductCostBasis(
        {
          priceMinor: product.priceMinor?.toNumber() ?? null,
          lastKnownCostMinor: product.lastKnownCostMinor?.toNumber() ?? null,
        },
        null,
      );

      items.push({
        productId: product.id,
        name: product.name,
        locationCode: location.code,
        quantityOnHand: sum.quantityOnHand,
        active: product.active,
        costBasisMinor: basis?.costBasisMinor ?? null,
        hasCostBasis: basis !== null,
      });
    }

    const ingredientSums = await sumMovementsByIngredientAtLocation(db, location.id);
    for (const sum of ingredientSums) {
      const ingredient = ingredientById.get(sum.ingredientId);
      if (!ingredient) continue;
      ingredientRows.push({
        ingredientId: ingredient.id,
        name: ingredient.name,
        locationCode: location.code,
        quantityOnHand: sum.quantityOnHand,
        active: ingredient.active,
      });
    }
  }

  items.sort((a, b) => a.locationCode.localeCompare(b.locationCode) || a.name.localeCompare(b.name));
  ingredientRows.sort(
    (a, b) => a.locationCode.localeCompare(b.locationCode) || a.name.localeCompare(b.name),
  );

  // Baseline for verify-reset.ts: what the catalogue held before the wipe.
  // Without this, "is the recipe table empty?" cannot distinguish a table
  // the reset destroyed from one that was always empty.
  const catalogueCounts = {
    product: await db.product.count(),
    category: await db.category.count(),
    ingredient: await db.ingredient.count(),
    recipe: await db.recipe.count(),
    recipeLine: await db.recipeLine.count(),
    staffMember: await db.staffMember.count(),
    location: await db.location.count(),
  };

  const snapshot = {
    takenAt: new Date().toISOString(),
    catalogueCounts,
    note:
      "Derived stock on hand at the moment of capture, per product per location and per " +
      "ingredient per location. Produced by scripts/snapshot-stock.ts before the 2026-08-17 " +
      "transaction reset. Rows are the sum of all stock movements; an item with no movements " +
      "at a location is absent, not zero.",
    items,
    ingredients: ingredientRows,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  // Human-readable sign-off sheet — this is what the owner actually checks
  // against the shelves, so it is plain text, grouped by location, no IDs.
  const sheetPath = outPath.replace(/\.json$/, ".txt");
  const lines: string[] = [];
  lines.push(`STOCK ON HAND — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
  lines.push("");
  lines.push("Check these figures before anything is deleted.");
  lines.push("");

  for (const location of locations) {
    const locItems = items.filter((i) => i.locationCode === location.code);
    if (locItems.length > 0) {
      lines.push(`=== ${location.name.toUpperCase()} — PRODUCTS (${locItems.length}) ===`);
      for (const item of locItems) {
        const flags = [
          !item.active ? "INACTIVE" : null,
          !item.hasCostBasis ? "NO COST BASIS" : null,
        ]
          .filter(Boolean)
          .join(", ");
        lines.push(
          `  ${item.name.padEnd(38)} ${String(item.quantityOnHand).padStart(10)}${flags ? `   [${flags}]` : ""}`,
        );
      }
      lines.push("");
    }

    const locIngredients = ingredientRows.filter((i) => i.locationCode === location.code);
    if (locIngredients.length > 0) {
      lines.push(`=== ${location.name.toUpperCase()} — INGREDIENTS (${locIngredients.length}) ===`);
      for (const ing of locIngredients) {
        lines.push(
          `  ${ing.name.padEnd(38)} ${String(ing.quantityOnHand).padStart(10)}${ing.active ? "" : "   [INACTIVE]"}`,
        );
      }
      lines.push("");
    }
  }

  const noCost = items.filter((i) => !i.hasCostBasis);
  const inactiveWithStock = [...items, ...ingredientRows].filter(
    (r) => !r.active && r.quantityOnHand !== 0,
  );
  const negatives = [...items, ...ingredientRows].filter((r) => r.quantityOnHand < 0);

  lines.push("--- SUMMARY ---");
  lines.push(`  product rows:     ${items.length}`);
  lines.push(`  ingredient rows:  ${ingredientRows.length}`);
  lines.push(`  no cost basis:    ${noCost.length}   (these CANNOT be reloaded — must be fixed first)`);
  lines.push(`  inactive w/stock: ${inactiveWithStock.length}   (these CANNOT be reloaded — see preflight)`);
  lines.push(`  negative on hand: ${negatives.length}`);
  fs.writeFileSync(sheetPath, lines.join("\n") + "\n");

  console.log(`Snapshot written: ${outPath}`);
  console.log(`Sign-off sheet:   ${sheetPath}`);
  console.log("");
  console.log(`  product rows:     ${items.length}`);
  console.log(`  ingredient rows:  ${ingredientRows.length}`);
  console.log(`  no cost basis:    ${noCost.length}`);
  console.log(`  inactive w/stock: ${inactiveWithStock.length}`);
  console.log(`  negative on hand: ${negatives.length}`);
  console.log("");
  console.log("READ-ONLY — nothing was written to the database.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
