// Loads the physical closing-stock snapshot from
// `scripts/opening balance/v2-closing-stock-2026-08-14.json` as a real
// owner stock count + correction at each location, using the actual module
// logic (recordStockCount / correctStockCount) rather than raw Prisma
// writes — so the result is exactly what a real owner session would have
// produced.
//
// Why "corrected", not "received": receiving mutates lastKnownCostMinor
// and feeds the cost-of-goods-sold "bought" sum — this snapshot is not a
// real purchase, so it must not touch either. A stock-count correction
// updates the on-hand quantity (and therefore closing stock value, which
// reporting derives separately as quantity x cost) without any of that.
//
// Run scripts/import-v2-catalog.ts BEFORE this script — it creates every
// product/ingredient this loader needs, including the location-suffixed
// names (e.g. "Dasani 500ml (Restaurant)") and the 24 extra products the
// closing-stock file references that aren't in the catalog export.
//
// Items never logged in the legacy system at all are absent from the JSON
// entirely (not zero) — per the file's own note, they are simply not
// counted here; a genuinely uncounted item keeps no StockMovement, not a
// fabricated zero one.
//
// Usage: npx tsx scripts/load-closing-stock.ts [--dry-run]

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordStockCount, correctStockCount } from "@/modules/stock/logic";
import type { AuthenticatedStaff } from "@/modules/people/logic";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const CLOSING_STOCK_PATH = "scripts/opening balance/v2-closing-stock-2026-08-14.json";

type ItemRow = {
  name: string;
  location: "restaurant" | "canteen";
  closing_stock: number;
  closing_stock_value: number;
  stale: boolean;
};
type IngredientRow = { name: string; closing_stock: number; stale: boolean };

// Same location-suffix convention as import-v2-catalog.ts, for the six
// product names that needed two distinct catalog rows (one per location).
const SUFFIXED_NAMES: Record<string, string> = {
  "Dasani 500ml::restaurant": "Dasani 500ml (Restaurant)",
  "Dasani 500ml::canteen": "Dasani 500ml (Canteen)",
  "Bottles::restaurant": "Bottles (Restaurant)",
  "Bottles::canteen": "Bottles (Canteen)",
  "Envelops 10::restaurant": "Envelops 10 (Restaurant)",
  "Envelops 10::canteen": "Envelops 10 (Canteen)",
  "Kibuyu 2lit::restaurant": "Kibuyu 2lit (Restaurant)",
  "Kibuyu 2lit::canteen": "Kibuyu 2lit (Canteen)",
  "Mitungi 10lit::restaurant": "Mitungi 10lit (Restaurant)",
  "Mitungi 10lit::canteen": "Mitungi 10lit (Canteen)",
  "Mitungi 20lit::restaurant": "Mitungi 20lit (Restaurant)",
  "Mitungi 20lit::canteen": "Mitungi 20lit (Canteen)",
};

function resolvedName(name: string, locationCode: "restaurant" | "canteen"): string {
  return SUFFIXED_NAMES[`${name}::${locationCode}`] ?? name;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(CLOSING_STOCK_PATH, "utf-8")) as {
    items: ItemRow[];
    ingredients: IngredientRow[];
  };

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
  const locationByCode = new Map(locations.map((l) => [l.code, l]));

  const products = await db.product.findMany();
  const productByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));

  const ingredients = await db.ingredient.findMany();
  const ingredientByName = new Map(ingredients.map((i) => [i.name.trim().toLowerCase(), i]));

  console.log(`${dryRun ? "[dry-run] " : ""}Loading closing stock as ${owner.name} (owner)...\n`);

  async function loadProductsAtLocation(locationCode: "restaurant" | "canteen") {
    const location = locationByCode.get(locationCode)!;
    const rows = data.items.filter((r) => r.location === locationCode);
    console.log(`--- ${locationCode}: building stock count (${rows.length} product rows) ---`);

    const lines: { itemType: "product"; itemId: string; countedQuantity: number; name: string }[] = [];
    for (const row of rows) {
      const lookupName = resolvedName(row.name, locationCode).trim().toLowerCase();
      const product = productByName.get(lookupName);
      if (!product) {
        console.log(`  UNMATCHED (skipping): "${row.name}" @ ${locationCode}`);
        continue;
      }
      lines.push({
        itemType: "product",
        itemId: product.id,
        countedQuantity: row.closing_stock,
        name: product.name,
      });
    }

    if (dryRun) {
      console.log(`  [dry-run] would record count with ${lines.length} lines, then correct each to match`);
      return;
    }
    if (lines.length === 0) return;

    const countResult = await recordStockCount(db, requester, {
      locationId: location.id,
      lines: lines.map(({ itemType, itemId, countedQuantity }) => ({ itemType, itemId, countedQuantity })),
    });
    if (!countResult.ok) {
      console.log(`  FAILED to record count: ${countResult.reason}`);
      return;
    }
    console.log(`  recorded count ${countResult.count.id} with ${lines.length} lines`);

    for (const line of countResult.count.lines) {
      const correction = await correctStockCount(db, requester, {
        stockCountId: countResult.count.id,
        lineId: line.id,
        correctedQuantity: line.countedQuantity,
      });
      const name = lines.find((l) => l.itemId === line.itemId)?.name ?? line.itemId;
      if (!correction.ok) console.log(`    FAILED correction for ${name}: ${correction.reason}`);
      else console.log(`    corrected ${name} -> ${line.countedQuantity}`);
    }
  }

  await loadProductsAtLocation("restaurant");
  await loadProductsAtLocation("canteen");

  // Ingredients: central store, recorded against the restaurant location —
  // IngredientMovement requires a locationId and only the restaurant has
  // recipes consuming ingredients (confirmed with user in a prior session).
  console.log(`\n--- ingredients: building stock count (${data.ingredients.length} rows) ---`);
  {
    const location = locationByCode.get("restaurant")!;
    const lines: { itemType: "ingredient"; itemId: string; countedQuantity: number; name: string }[] = [];
    for (const row of data.ingredients) {
      const ingredient = ingredientByName.get(row.name.trim().toLowerCase());
      if (!ingredient) {
        console.log(`  UNMATCHED (skipping): "${row.name}"`);
        continue;
      }
      if (!ingredient.active) {
        console.log(`  SKIPPING (inactive): "${row.name}"`);
        continue;
      }
      lines.push({
        itemType: "ingredient",
        itemId: ingredient.id,
        countedQuantity: row.closing_stock,
        name: ingredient.name,
      });
    }

    if (dryRun) {
      console.log(`  [dry-run] would record count with ${lines.length} lines, then correct each to match`);
    } else if (lines.length > 0) {
      const countResult = await recordStockCount(db, requester, {
        locationId: location.id,
        lines: lines.map(({ itemType, itemId, countedQuantity }) => ({ itemType, itemId, countedQuantity })),
      });
      if (!countResult.ok) {
        console.log(`  FAILED to record count: ${countResult.reason}`);
      } else {
        console.log(`  recorded count ${countResult.count.id} with ${lines.length} lines`);
        for (const line of countResult.count.lines) {
          const correction = await correctStockCount(db, requester, {
            stockCountId: countResult.count.id,
            lineId: line.id,
            correctedQuantity: line.countedQuantity,
          });
          const name = lines.find((l) => l.itemId === line.itemId)?.name ?? line.itemId;
          if (!correction.ok) console.log(`    FAILED correction for ${name}: ${correction.reason}`);
          else console.log(`    corrected ${name} -> ${line.countedQuantity}`);
        }
      }
    }
  }

  console.log(`\n${dryRun ? "(dry run — nothing was written)" : "Done."}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
