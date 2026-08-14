/*
  Warnings:

  - You are about to alter the column `dailyRateMinor` on the `staff_members` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `priceMinor` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `lastKnownCostMinor` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `lastKnownCostMinor` on the `ingredients` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `totalMinor` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `deliveryFeeMinor` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `priceMinor` on the `sale_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountMinor` on the `payment_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountMinor` on the `repayments` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `costBasisMinor` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `sellingValueMinor` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `unitCostMinor` on the `ingredient_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `costBasisMinor` on the `ingredient_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `sellingValueMinor` on the `ingredient_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `expectedCashMinor` on the `handovers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `expectedMpesaMinor` on the `handovers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `actualCashMinor` on the `handovers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `actualMpesaMinor` on the `handovers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountMinor` on the `expenses` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountMinor` on the `drawing_debts` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountMinor` on the `drawing_repayments` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "staff_members" ALTER COLUMN "dailyRateMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "priceMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "lastKnownCostMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "lastKnownCostMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "totalMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "deliveryFeeMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sale_lines" ALTER COLUMN "priceMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payment_lines" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "repayments" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "costBasisMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "sellingValueMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ingredient_movements" ALTER COLUMN "unitCostMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "costBasisMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "sellingValueMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "handovers" ALTER COLUMN "expectedCashMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "expectedMpesaMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "actualCashMinor" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "actualMpesaMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "drawing_debts" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "drawing_repayments" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(10,2);
