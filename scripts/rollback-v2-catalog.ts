// Removes exactly what import-v2-catalog.ts creates, matched by name
// against the same JSON — a targeted undo, not a blanket delete, so
// pre-existing rows (e.g. seed data that happened to share a name) are
// never touched.
//
// Usage: npx tsx scripts/rollback-v2-catalog.ts [--dry-run]

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const raw = readFileSync("scripts/v2-catalog-export.json", "utf-8");
  const data = JSON.parse(raw);

  const productNames: string[] = data.items.map((i: { name: string }) => i.name);
  const ingredientNames: string[] = data.ingredients.map((i: { name: string }) => i.name);
  const categoryNames: string[] = Array.from(
    new Set<string>(data.items.map((i: { category: string }) => i.category)),
  );

  // "Sausage" and "Potatoes" pre-date the import (they're in prisma/seed.ts
  // and were skipped as already-existing when import-v2-catalog.ts ran) —
  // excluded here so the rollback never deletes real seed data.
  const preExisting = new Set(["Sausage", "Potatoes"]);

  const productsToDelete = await db.product.findMany({
    where: { name: { in: productNames.filter((n) => !preExisting.has(n)) } },
  });
  const ingredientsToDelete = await db.ingredient.findMany({
    where: { name: { in: ingredientNames.filter((n) => !preExisting.has(n)) } },
  });

  const productIds = productsToDelete.map((p) => p.id);

  // Sales referencing an imported product must go too (dev-only test
  // sales created while browsing the imported catalogue) — cascade
  // through PaymentLine and SaleLine first, then the Sale itself.
  const saleLines = await db.saleLine.findMany({ where: { productId: { in: productIds } } });
  const saleIds = [...new Set(saleLines.map((l) => l.saleId))];
  if (saleIds.length > 0) {
    console.log(
      `${dryRun ? "[dry-run] would delete" : "deleting"} ${saleIds.length} sale(s) referencing imported products ` +
        `(dev-only test sales), including their payment and sale lines`,
    );
    if (!dryRun) {
      await db.paymentLine.deleteMany({ where: { saleId: { in: saleIds } } });
      await db.saleLine.deleteMany({ where: { saleId: { in: saleIds } } });
      await db.sale.deleteMany({ where: { id: { in: saleIds } } });
    }
  }

  const movementCount = await db.stockMovement.count({ where: { productId: { in: productIds } } });
  if (movementCount > 0) {
    console.log(
      `${dryRun ? "[dry-run] would delete" : "deleting"} ${movementCount} stock movement(s) ` +
        `referencing imported products (dev-only exploration data)`,
    );
    if (!dryRun) await db.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  }

  console.log(`${dryRun ? "[dry-run] would delete" : "deleting"} ${productsToDelete.length} products`);
  if (!dryRun && productIds.length > 0) {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
  }

  console.log(`${dryRun ? "[dry-run] would delete" : "deleting"} ${ingredientsToDelete.length} ingredients`);
  if (!dryRun && ingredientsToDelete.length > 0) {
    await db.ingredient.deleteMany({ where: { id: { in: ingredientsToDelete.map((i) => i.id) } } });
  }

  // Only remove categories the import could have created, and only if
  // nothing references them anymore (don't touch a category that already
  // had other products before the import, or still does after this delete).
  for (const name of categoryNames) {
    const category = await db.category.findUnique({ where: { name } });
    if (!category) continue;
    const remaining = await db.product.count({ where: { categoryId: category.id } });
    if (remaining === 0) {
      console.log(`${dryRun ? "[dry-run] would delete" : "deleting"} now-empty category: ${name}`);
      if (!dryRun) await db.category.delete({ where: { id: category.id } });
    } else {
      console.log(`keeping category (still in use): ${name}`);
    }
  }

  console.log(dryRun ? "\n(dry run — nothing was written)" : "\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
