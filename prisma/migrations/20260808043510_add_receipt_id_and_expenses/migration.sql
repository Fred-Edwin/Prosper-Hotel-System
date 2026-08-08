/*
  Warnings:

  - Added the required column `receiptId` to the `ingredient_movements` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('stock', 'running', 'asset', 'drawing');

-- AlterTable
ALTER TABLE "ingredient_movements" ADD COLUMN     "receiptId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "note" TEXT,
    "receiptId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_debts" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "drawing_debts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drawing_debts_expenseId_key" ON "drawing_debts"("expenseId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_debts" ADD CONSTRAINT "drawing_debts_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
