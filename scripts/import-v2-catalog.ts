// Loads scripts/opening balance/v2-catalog-export.json into a freshly
// wiped catalog (run scripts/clear-catalog-and-transactions.ts first).
// Creates Categories, then Products and Ingredients, using the real module
// logic (createCategory/createProduct/createIngredient/recordProductCost/
// recordIngredientCost from src/modules/catalogue/logic.ts) as an owner
// AuthenticatedStaff, so permissions/validation run exactly as they would
// for a real owner action.
//
// Also creates products referenced by the closing-stock snapshot
// (v2-closing-stock-2026-08-14.json) that have no entry in the catalog
// export at all (24 items — till-code names like "#15 Canteen" and generic
// supplies like "Bottles", "Serviettes", "Mitungi 10lit") — user decision:
// create them as ProductKind.goods, no category, no selling price. Cost is
// seeded from closing_stock_value / closing_stock where quantity > 0.
//
// Name collisions (same product name needed at both locations) are
// resolved with a "(Restaurant)"/"(Canteen)" suffix, matching the existing
// dev DB convention:
//   - Dasani 500ml: in the catalog export as both restaurant_only and
//     canteen_independent.
//   - Bottles, Envelops 10, Kibuyu 2lit, Mitungi 10lit, Mitungi 20lit: not
//     in the catalog export, but counted in the closing-stock snapshot at
//     both restaurant and canteen — user decision: one product per
//     location, suffixed, same as Dasani.
//
// Category -> ProductKind: meals -> cooked_food; a fixed list of cyber
// items (service charges, no physical stock) -> service; everything else
// -> goods.
//
// Location from supply_type: restaurant_only -> restaurant,
// canteen_independent -> canteen, canteen_supplied -> restaurant (home
// location is who produces/owns it, not where it's sold -- see
// Product.locationId doc comment).
//
// buying_price "0.00" means no real cost recorded -> treated as null, not
// zero, matching the nullable-until-set convention on lastKnownCostMinor.
//
// Despite the "Minor" suffix, every *Minor field in this codebase is a
// plain whole-shilling amount, not cents -- see docs/bugs.md BUG-11 and
// src/shared/money.ts's comment. Source prices/costs are used as-is, no
// x100 scaling.
//
// Usage: npx tsx scripts/import-v2-catalog.ts [--dry-run]

import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  createCategory,
  createProduct,
  createIngredient,
  recordProductCost,
  recordIngredientCost,
} from "@/modules/catalogue/logic";
import type { ProductKind } from "@/modules/catalogue/schema";
import type { AuthenticatedStaff } from "@/modules/people/logic";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const CATALOG_PATH = "scripts/opening balance/v2-catalog-export.json";
const CLOSING_STOCK_PATH = "scripts/opening balance/v2-closing-stock-2026-08-14.json";

type CatalogProduct = {
  name: string;
  category: string;
  supply_type: "restaurant_only" | "canteen_independent" | "canteen_supplied";
  buying_price: string;
  selling_price: string;
  low_stock_threshold: string;
  active: boolean;
};

type CatalogIngredient = {
  name: string;
  unit: string;
  buying_price: string;
  low_stock_threshold: string;
  active: boolean;
};

// Category "cyber" items that are service charges with no physical stock
// unit -- user decision, see handover-prompt.md point 3.
const SERVICE_CYBER_ITEMS = new Set([
  "Binding",
  "Photocopy",
  "Spiral Binding",
  "Spiral Binding (70)",
  "Tape Binding",
  "Paste",
  "Logbook",
  "Logbook Assessment",
  "Logbook HSA",
  "Logbook Industrial",
  "Printing/Papers",
  "Blue Forms",
  "Research",
  "SHA & Others",
]);

function productKindFor(category: string, name: string): ProductKind {
  if (category === "meals") return "cooked_food";
  if (category === "cyber" && SERVICE_CYBER_ITEMS.has(name)) return "service";
  return "goods";
}

function locationCodeFor(supplyType: CatalogProduct["supply_type"]): "restaurant" | "canteen" {
  if (supplyType === "canteen_independent") return "canteen";
  return "restaurant"; // restaurant_only, canteen_supplied
}

// Despite the "Minor" suffix, every *Minor field in this codebase is a
// plain whole-shilling amount, never cents (see docs/bugs.md BUG-11 and
// src/shared/money.ts's comment) -- so no x100 scaling here.
function toMinor(price: string): number | null {
  const value = parseFloat(price);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

// Name collisions needing a location suffix -- see file header. Keyed by
// (name, locationCode) so each side gets a distinct final name.
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

// 24 products referenced by the closing-stock snapshot with no catalog
// export entry at all. locationCodes lists every location it was counted
// at (most appear at one, five appear at both -- see SUFFIXED_NAMES).
const EXTRA_PRODUCTS: { name: string; locationCodes: ("restaurant" | "canteen")[] }[] = [
  { name: "#15 Canteen", locationCodes: ["canteen"] },
  { name: "#22 Canteen", locationCodes: ["canteen"] },
  { name: "#25", locationCodes: ["canteen"] },
  { name: "#44", locationCodes: ["canteen"] },
  { name: "Bisc za 10/=", locationCodes: ["canteen"] },
  { name: "Bisc za 15/=", locationCodes: ["canteen"] },
  { name: "Bisc za 25/=", locationCodes: ["canteen"] },
  { name: "Bottles", locationCodes: ["canteen", "restaurant"] },
  { name: "Envelops 10", locationCodes: ["canteen", "restaurant"] },
  { name: "Handkerchief 50", locationCodes: ["canteen"] },
  { name: "Kibuyu 2lit", locationCodes: ["canteen", "restaurant"] },
  { name: "Lotta", locationCodes: ["canteen"] },
  { name: "Masks", locationCodes: ["canteen"] },
  { name: "Mitungi 10lit", locationCodes: ["canteen", "restaurant"] },
  { name: "Mitungi 20lit", locationCodes: ["canteen", "restaurant"] },
  { name: "Panandol Extra", locationCodes: ["canteen"] },
  { name: "Serviettes", locationCodes: ["canteen"] },
  { name: "Spoons", locationCodes: ["canteen"] },
  { name: "Sunny Girl Pads", locationCodes: ["canteen"] },
  { name: "Sweets", locationCodes: ["canteen"] },
  { name: "Toilex", locationCodes: ["canteen"] },
  { name: "Tropical", locationCodes: ["canteen"] },
  { name: "Take away Coffee cups", locationCodes: ["restaurant"] },
  { name: "Take away dishes", locationCodes: ["restaurant"] },
];

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as {
    items: CatalogProduct[];
    ingredients: CatalogIngredient[];
  };
  const closingStock = JSON.parse(fs.readFileSync(CLOSING_STOCK_PATH, "utf-8")) as {
    items: { name: string; location: string; closing_stock: number; closing_stock_value: number }[];
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

  console.log(`${dryRun ? "[dry-run] " : ""}Importing v2 catalog as ${owner.name} (owner)...\n`);

  // --- Categories ---
  const categoryNames = [...new Set(catalog.items.map((i) => i.category))];
  console.log(`--- Categories (${categoryNames.length}) ---`);
  const categoryIdByName = new Map<string, string>();
  for (const name of categoryNames) {
    if (dryRun) {
      console.log(`  [dry-run] would create category "${name}"`);
      continue;
    }
    const result = await createCategory(db, requester, { name });
    if (!result.ok) {
      console.log(`  FAILED "${name}": ${result.reason}`);
    } else {
      categoryIdByName.set(name, result.value.id);
      console.log(`  created "${name}"`);
    }
  }

  // --- Products from catalog export ---
  console.log(`\n--- Products from catalog export (${catalog.items.length}) ---`);
  let productsCreated = 0;
  let productsFailed = 0;
  let costsSeeded = 0;
  for (const item of catalog.items) {
    const locationCode = locationCodeFor(item.supply_type);
    const location = locationByCode.get(locationCode)!;
    const kind = productKindFor(item.category, item.name);
    const name = resolvedName(item.name, locationCode);
    const priceMinor = toMinor(item.selling_price);
    const costMinor = toMinor(item.buying_price);
    const lowStockLevel = parseFloat(item.low_stock_threshold);

    if (dryRun) {
      console.log(
        `  [dry-run] would create "${name}" kind=${kind} @ ${locationCode} price=${priceMinor} cost=${costMinor} active=${item.active}`,
      );
      productsCreated++;
      continue;
    }

    const result = await createProduct(db, requester, {
      name,
      kind,
      priceMinor,
      categoryId: categoryIdByName.get(item.category) ?? null,
      locationId: location.id,
    });
    if (!result.ok) {
      console.log(`  FAILED "${name}": ${result.reason}`);
      productsFailed++;
      continue;
    }
    productsCreated++;

    if (!Number.isNaN(lowStockLevel)) {
      await db.product.update({
        where: { id: result.value.id },
        data: { lowStockLevel, active: item.active },
      });
    } else {
      await db.product.update({ where: { id: result.value.id }, data: { active: item.active } });
    }

    if (costMinor != null) {
      const costResult = await recordProductCost(db, requester, result.value.id, { unitCostMinor: costMinor });
      if (!costResult.ok) {
        console.log(`    FAILED to seed cost for "${name}": ${costResult.reason}`);
      } else {
        costsSeeded++;
      }
    }
  }

  // --- Extra products (closing-stock only, not in catalog export) ---
  console.log(`\n--- Extra products from closing-stock only (${EXTRA_PRODUCTS.length}) ---`);
  const closingByNameLocation = new Map(
    closingStock.items.map((r) => [`${r.name}::${r.location}`, r]),
  );
  let extrasCreated = 0;
  let extraCostsSeeded = 0;
  for (const spec of EXTRA_PRODUCTS) {
    for (const locationCode of spec.locationCodes) {
      const location = locationByCode.get(locationCode)!;
      const name = resolvedName(spec.name, locationCode);
      const row = closingByNameLocation.get(`${spec.name}::${locationCode}`);
      const unitCostMinor =
        row && row.closing_stock > 0 && row.closing_stock_value > 0
          ? Math.round((row.closing_stock_value / row.closing_stock) * 100) / 100
          : null;

      if (dryRun) {
        console.log(
          `  [dry-run] would create "${name}" kind=goods @ ${locationCode} price=null cost=${unitCostMinor}`,
        );
        extrasCreated++;
        continue;
      }

      const result = await createProduct(db, requester, {
        name,
        kind: "goods",
        priceMinor: null,
        categoryId: null,
        locationId: location.id,
      });
      if (!result.ok) {
        console.log(`  FAILED "${name}": ${result.reason}`);
        continue;
      }
      extrasCreated++;

      if (unitCostMinor != null) {
        const costResult = await recordProductCost(db, requester, result.value.id, {
          unitCostMinor,
        });
        if (!costResult.ok) {
          console.log(`    FAILED to seed cost for "${name}": ${costResult.reason}`);
        } else {
          extraCostsSeeded++;
        }
      }
    }
  }

  // --- Ingredients ---
  console.log(`\n--- Ingredients (${catalog.ingredients.length}) ---`);
  let ingredientsCreated = 0;
  let ingredientCostsSeeded = 0;
  for (const item of catalog.ingredients) {
    const costMinor = toMinor(item.buying_price);
    const lowStockLevel = parseFloat(item.low_stock_threshold);

    if (dryRun) {
      console.log(
        `  [dry-run] would create "${item.name}" unit=${item.unit} cost=${costMinor} active=${item.active}`,
      );
      ingredientsCreated++;
      continue;
    }

    const result = await createIngredient(db, requester, {
      name: item.name,
      unitOfMeasure: item.unit,
      lastKnownCostMinor: null,
    });
    if (!result.ok) {
      console.log(`  FAILED "${item.name}": ${result.reason}`);
      continue;
    }
    ingredientsCreated++;

    if (!Number.isNaN(lowStockLevel)) {
      await db.ingredient.update({
        where: { id: result.value.id },
        data: { lowStockLevel, active: item.active },
      });
    } else {
      await db.ingredient.update({ where: { id: result.value.id }, data: { active: item.active } });
    }

    if (costMinor != null) {
      const costResult = await recordIngredientCost(db, requester, result.value.id, { unitCostMinor: costMinor });
      if (!costResult.ok) {
        console.log(`    FAILED to seed cost for "${item.name}": ${costResult.reason}`);
      } else {
        ingredientCostsSeeded++;
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Categories: ${categoryNames.length}`);
  console.log(`Products from catalog: created=${productsCreated} failed=${productsFailed} costsSeeded=${costsSeeded}`);
  console.log(`Extra products from closing-stock: created=${extrasCreated} costsSeeded=${extraCostsSeeded}`);
  console.log(`Ingredients: created=${ingredientsCreated} costsSeeded=${ingredientCostsSeeded}`);
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
