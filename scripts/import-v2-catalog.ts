// One-off import of the v2 (prime-hotel-demo) catalog export into this
// app's catalogue module. Products only — no stock quantities, no
// delivery_locations (no matching model here; dropped per owner decision).
//
// supply_type -> locationId mapping (owner-confirmed):
//   restaurant_only      -> restaurant
//   canteen_independent  -> canteen
//   canteen_supplied     -> restaurant (made at restaurant, transferred to
//                           canteen via the existing transfer mechanic —
//                           docs/architecture.md's "sellable-at-a-location
//                           is the union of both sources")
//
// kind inferred from category (owner-confirmed):
//   meals   -> cooked_food
//   cyber   -> service
//   other   -> goods (snacks stays goods, even cooked snack items)
//
// Usage: node scripts/import-v2-catalog.mjs [--dry-run]

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { ProductKind } from "@/generated/prisma/enums";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type CatalogItem = {
  name: string;
  category: string;
  supply_type: string;
  buying_price: string;
  selling_price: string;
  low_stock_threshold: string | null;
  active: boolean;
};

type CatalogIngredient = {
  name: string;
  unit: string;
  buying_price: string;
  low_stock_threshold: string | null;
  active: boolean;
};

type CatalogExport = {
  items: CatalogItem[];
  ingredients: CatalogIngredient[];
};

const SUPPLY_TYPE_TO_LOCATION_CODE: Record<string, string> = {
  restaurant_only: "restaurant",
  canteen_independent: "canteen",
  canteen_supplied: "restaurant",
};

// Owner-confirmed: a name that appears twice with different supply_types
// (e.g. "Dasani 500ml" at both restaurant_only and canteen_independent) is
// two real, independently priced/stocked products, not a duplicate — the
// unique constraint on products.name means both need distinct names.
function disambiguateDuplicateNames<T extends { name: string; supply_type: string }>(items: T[]): T[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);

  return items.map((item) => {
    if ((counts.get(item.name) ?? 0) < 2) return item;
    const locationCode = SUPPLY_TYPE_TO_LOCATION_CODE[item.supply_type];
    const suffix = locationCode === "canteen" ? "Canteen" : "Restaurant";
    return { ...item, name: `${item.name} (${suffix})` };
  });
}

function kindForCategory(category: string): ProductKind {
  if (category === "meals") return "cooked_food";
  if (category === "cyber") return "service";
  return "goods";
}

// Despite the *Minor field names, src/shared/money.ts is explicit: this app
// stores plain whole shillings, not cents (see BUG-11) — no ×100 scaling.
function toShillings(decimalString: string): number | null {
  const value = Number(decimalString);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

async function main() {
  const raw = readFileSync("scripts/v2-catalog-export.json", "utf-8");
  const data: CatalogExport = JSON.parse(raw);

  const locations = await db.location.findMany();
  const locationIdByCode = Object.fromEntries(locations.map((l) => [l.code, l.id]));
  if (!locationIdByCode.restaurant || !locationIdByCode.canteen) {
    throw new Error("Expected both restaurant and canteen Location rows to exist already.");
  }

  data.items = disambiguateDuplicateNames(data.items);

  const categoryNames = [...new Set(data.items.map((i) => i.category as string))];
  const categoryIdByName: Record<string, string> = {};
  for (const name of categoryNames) {
    const existing = await db.category.findUnique({ where: { name } });
    if (existing) {
      categoryIdByName[name] = existing.id;
      continue;
    }
    console.log(`${dryRun ? "[dry-run] would create" : "creating"} category: ${name}`);
    if (!dryRun) {
      const created = await db.category.create({ data: { name } });
      categoryIdByName[name] = created.id;
    }
  }

  let productsCreated = 0;
  let productsSkipped = 0;
  for (const item of data.items) {
    const existing = await db.product.findUnique({ where: { name: item.name } });
    if (existing) {
      console.log(`skip (already exists): ${item.name}`);
      productsSkipped++;
      continue;
    }

    const locationCode = SUPPLY_TYPE_TO_LOCATION_CODE[item.supply_type];
    if (!locationCode) {
      console.warn(`SKIP unknown supply_type "${item.supply_type}" for ${item.name}`);
      productsSkipped++;
      continue;
    }

    const priceMinor = toShillings(item.selling_price);
    const lastKnownCostMinor = toShillings(item.buying_price);
    const lowStockLevel = item.low_stock_threshold != null ? Math.round(Number(item.low_stock_threshold)) : null;

    console.log(
      `${dryRun ? "[dry-run] would create" : "creating"} product: ${item.name} ` +
        `(${locationCode}, ${kindForCategory(item.category)}, price=${priceMinor})`,
    );

    if (!dryRun) {
      await db.product.create({
        data: {
          name: item.name,
          kind: kindForCategory(item.category),
          priceMinor,
          // Skip zero buying_price rows — those are "not yet known" in the
          // source, not an authoritative cost of zero.
          lastKnownCostMinor: lastKnownCostMinor && lastKnownCostMinor > 0 ? lastKnownCostMinor : null,
          lowStockLevel,
          active: item.active,
          categoryId: categoryIdByName[item.category] ?? null,
          locationId: locationIdByCode[locationCode],
        },
      });
    }
    productsCreated++;
  }

  let ingredientsCreated = 0;
  let ingredientsSkipped = 0;
  for (const ing of data.ingredients) {
    const existing = await db.ingredient.findUnique({ where: { name: ing.name } });
    if (existing) {
      console.log(`skip (already exists): ${ing.name}`);
      ingredientsSkipped++;
      continue;
    }

    const lastKnownCostMinor = toShillings(ing.buying_price);
    const lowStockLevel = ing.low_stock_threshold != null ? Math.round(Number(ing.low_stock_threshold)) : null;

    console.log(`${dryRun ? "[dry-run] would create" : "creating"} ingredient: ${ing.name}`);

    if (!dryRun) {
      await db.ingredient.create({
        data: {
          name: ing.name,
          unitOfMeasure: ing.unit,
          lastKnownCostMinor: lastKnownCostMinor && lastKnownCostMinor > 0 ? lastKnownCostMinor : null,
          lowStockLevel,
          active: ing.active,
        },
      });
    }
    ingredientsCreated++;
  }

  console.log(
    `\nDone. Products: ${productsCreated} created, ${productsSkipped} skipped. ` +
      `Ingredients: ${ingredientsCreated} created, ${ingredientsSkipped} skipped.`,
  );
  if (dryRun) console.log("(dry run — nothing was written)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
