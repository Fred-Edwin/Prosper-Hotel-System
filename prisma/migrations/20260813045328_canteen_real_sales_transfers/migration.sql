-- CreateEnum
CREATE TYPE "TransferItemType" AS ENUM ('product', 'ingredient');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'confirmed');

-- AlterEnum
BEGIN;
-- sold_derived is retired by this migration (canteen sales are now recorded
-- directly, not inferred from stock counts); backfill historical rows to
-- the closest surviving reason before narrowing the enum.
UPDATE "stock_movements" SET "reason" = 'sold' WHERE "reason" = 'sold_derived';
UPDATE "ingredient_movements" SET "reason" = 'sold' WHERE "reason" = 'sold_derived';
CREATE TYPE "StockMovementReason_new" AS ENUM ('received', 'transferred', 'sold', 'transfer_shortfall', 'wasted', 'consumed', 'given_away', 'issued', 'produced', 'corrected');
ALTER TABLE "stock_movements" ALTER COLUMN "reason" TYPE "StockMovementReason_new" USING ("reason"::text::"StockMovementReason_new");
ALTER TABLE "ingredient_movements" ALTER COLUMN "reason" TYPE "StockMovementReason_new" USING ("reason"::text::"StockMovementReason_new");
ALTER TYPE "StockMovementReason" RENAME TO "StockMovementReason_old";
ALTER TYPE "StockMovementReason_new" RENAME TO "StockMovementReason";
DROP TYPE "public"."StockMovementReason_old";
COMMIT;

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "itemType" "TransferItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "sentQuantity" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "sentByStaffMemberId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedQuantity" INTEGER,
    "confirmedByStaffMemberId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "reversedTransferId" TEXT,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sentByStaffMemberId_fkey" FOREIGN KEY ("sentByStaffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_confirmedByStaffMemberId_fkey" FOREIGN KEY ("confirmedByStaffMemberId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
