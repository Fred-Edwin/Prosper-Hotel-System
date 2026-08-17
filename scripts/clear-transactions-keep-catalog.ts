// Deletes all transactional history while KEEPING the catalogue, staff and
// locations. Written for the 2026-08-17 reset, where the owner confirmed
// the product catalogue, prices and current stock figures are all correct
// and only the weekend's trading entries are wrong.
//
// NOT the same as scripts/clear-catalog-and-transactions.ts, which also
// drops Product/Category/Ingredient/Recipe. That script was for the August
// legacy import, where the catalogue was being replaced wholesale. Running
// it today would destroy exactly what the owner asked us to preserve.
//
// This script deletes stock movements, which is what makes every stock
// level read zero afterwards (a level is the sum of its movements, not a
// stored figure). That is expected and is undone by
// reload-opening-stock.ts, which must be run immediately after this using
// the snapshot taken BEFORE this ran. Do not run this without that
// snapshot in hand.
//
// Delete order follows foreign-key dependencies: children before parents.
//
// Usage: npx tsx scripts/clear-transactions-keep-catalog.ts [--dry-run]

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const dryRun = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const counts = {
    // Cash side: drawing repayments/debts reference expenses.
    drawingRepayment: await db.drawingRepayment.count(),
    drawingDebt: await db.drawingDebt.count(),
    // Asset references Expense (nullable FK) — must go before expenses.
    // Owner confirmed no assets recorded; the count proves it before we run.
    asset: await db.asset.count(),
    expense: await db.expense.count(),
    handover: await db.handover.count(),
    // Owner confirmed no days worked recorded; count proves it.
    daysWorked: await db.daysWorked.count(),
    // Sales side: lines before sales.
    paymentLine: await db.paymentLine.count(),
    saleLine: await db.saleLine.count(),
    sale: await db.sale.count(),
    repayment: await db.repayment.count(),
    // Customers are transactional here (created by credit sales), and
    // PaymentLine/Sale/Repayment all reference them — delete after those.
    customer: await db.customer.count(),
    // Stock side: count lines before counts.
    stockCountLine: await db.stockCountLine.count(),
    stockCount: await db.stockCount.count(),
    transfer: await db.transfer.count(),
    stockMovement: await db.stockMovement.count(),
    ingredientMovement: await db.ingredientMovement.count(),
  };

  const kept = {
    location: await db.location.count(),
    staffMember: await db.staffMember.count(),
    product: await db.product.count(),
    category: await db.category.count(),
    ingredient: await db.ingredient.count(),
    recipe: await db.recipe.count(),
    recipeLine: await db.recipeLine.count(),
  };

  console.log(`${dryRun ? "[dry-run] WOULD DELETE" : "DELETING"}:`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(22)} ${String(count).padStart(8)}`);
  }
  console.log(`\nKEEPING (untouched):`);
  for (const [table, count] of Object.entries(kept)) {
    console.log(`  ${table.padEnd(22)} ${String(count).padStart(8)}`);
  }

  // The owner stated neither of these was ever recorded. If either is
  // non-zero the stated facts do not match the database, and deleting
  // would destroy real records nobody agreed to lose.
  if (counts.asset > 0 || counts.daysWorked > 0) {
    console.log(
      `\nSTOP: expected 0 assets and 0 days-worked (owner confirmed none were recorded), ` +
        `but found ${counts.asset} asset(s) and ${counts.daysWorked} days-worked row(s). ` +
        `Do not proceed — confirm with the owner what these are first.`,
    );
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("\n(dry run — nothing was written)");
    return;
  }

  // One transaction: a partial wipe would leave the books in a state that
  // is neither the old position nor a clean one.
  await db.$transaction(async (tx) => {
    await tx.drawingRepayment.deleteMany({});
    await tx.drawingDebt.deleteMany({});
    await tx.asset.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.handover.deleteMany({});
    await tx.daysWorked.deleteMany({});
    await tx.paymentLine.deleteMany({});
    await tx.saleLine.deleteMany({});
    await tx.sale.deleteMany({});
    await tx.repayment.deleteMany({});
    await tx.customer.deleteMany({});
    await tx.stockCountLine.deleteMany({});
    await tx.stockCount.deleteMany({});
    await tx.transfer.deleteMany({});
    await tx.stockMovement.deleteMany({});
    await tx.ingredientMovement.deleteMany({});
  });

  console.log("\nDone. Every stock level now reads 0 —");
  console.log("run scripts/reload-opening-stock.ts next to restore the counted position.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
