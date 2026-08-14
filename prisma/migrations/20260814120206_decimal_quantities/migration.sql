/*
  Warnings:

  - You are about to alter the column `quantity` on the `assets` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `ingredient_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `lowStockLevel` on the `ingredients` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `lowStockLevel` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `recipe_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `yieldQuantity` on the `recipes` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `sale_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `countedQuantity` on the `stock_count_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `expectedQuantity` on the `stock_count_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `sentQuantity` on the `transfers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `confirmedQuantity` on the `transfers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ingredient_movements" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "lowStockLevel" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "lowStockLevel" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "recipe_lines" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "recipes" ALTER COLUMN "yieldQuantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sale_lines" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "stock_count_lines" ALTER COLUMN "countedQuantity" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "expectedQuantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "transfers" ALTER COLUMN "sentQuantity" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "confirmedQuantity" SET DATA TYPE DECIMAL(10,2);
