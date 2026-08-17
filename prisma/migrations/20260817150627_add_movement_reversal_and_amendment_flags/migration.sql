-- AlterTable
ALTER TABLE "ingredient_movements" ADD COLUMN     "isAmendment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedBy" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "isAmendment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedBy" TEXT;
