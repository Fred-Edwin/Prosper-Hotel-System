-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementReason" ADD VALUE 'consumed';
ALTER TYPE "StockMovementReason" ADD VALUE 'given_away';

-- AlterTable
ALTER TABLE "ingredient_movements" ADD COLUMN     "costBasisMinor" INTEGER,
ADD COLUMN     "isEstimated" BOOLEAN,
ADD COLUMN     "sellingValueMinor" INTEGER,
ALTER COLUMN "unitCostMinor" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "costBasisMinor" INTEGER,
ADD COLUMN     "isEstimated" BOOLEAN,
ADD COLUMN     "sellingValueMinor" INTEGER;
