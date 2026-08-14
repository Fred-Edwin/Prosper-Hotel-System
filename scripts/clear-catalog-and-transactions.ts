// Wipes catalogue (Product/Category/Ingredient) and everything that would
// block deleting them (all transactional history), so the real client
// catalog can be imported clean. Deliberately does NOT touch Location,
// StaffMember, or Session — those are real staff logins, not test data.
//
// Same delete order as prisma/seed.ts, minus its Location/StaffMember/
// Session lines.
//
// Usage: npx tsx scripts/clear-catalog-and-transactions.ts [--dry-run]

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const counts = {
    drawingRepayment: await db.drawingRepayment.count(),
    drawingDebt: await db.drawingDebt.count(),
    asset: await db.asset.count(),
    expense: await db.expense.count(),
    daysWorked: await db.daysWorked.count(),
    handover: await db.handover.count(),
    stockCountLine: await db.stockCountLine.count(),
    stockCount: await db.stockCount.count(),
    paymentLine: await db.paymentLine.count(),
    saleLine: await db.saleLine.count(),
    sale: await db.sale.count(),
    repayment: await db.repayment.count(),
    customer: await db.customer.count(),
    recipeLine: await db.recipeLine.count(),
    recipe: await db.recipe.count(),
    ingredientMovement: await db.ingredientMovement.count(),
    ingredient: await db.ingredient.count(),
    transfer: await db.transfer.count(),
    stockMovement: await db.stockMovement.count(),
    product: await db.product.count(),
    category: await db.category.count(),
  };

  console.log(`${dryRun ? "[dry-run] would delete" : "deleting"}:`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log("(Location, StaffMember, Session are NOT touched)");

  if (dryRun) {
    console.log("\n(dry run — nothing was written)");
    return;
  }

  await db.drawingRepayment.deleteMany({});
  await db.drawingDebt.deleteMany({});
  await db.asset.deleteMany({});
  await db.expense.deleteMany({});
  await db.daysWorked.deleteMany({});
  await db.handover.deleteMany({});
  await db.stockCountLine.deleteMany({});
  await db.stockCount.deleteMany({});
  await db.paymentLine.deleteMany({});
  await db.saleLine.deleteMany({});
  await db.sale.deleteMany({});
  await db.repayment.deleteMany({});
  await db.customer.deleteMany({});
  await db.recipeLine.deleteMany({});
  await db.recipe.deleteMany({});
  await db.ingredientMovement.deleteMany({});
  await db.ingredient.deleteMany({});
  await db.transfer.deleteMany({});
  await db.stockMovement.deleteMany({});
  await db.product.deleteMany({});
  await db.category.deleteMany({});

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
