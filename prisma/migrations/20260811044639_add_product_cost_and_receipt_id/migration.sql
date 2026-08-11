-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lastKnownCostMinor" INTEGER;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "receiptId" TEXT;
