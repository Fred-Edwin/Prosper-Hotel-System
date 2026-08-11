-- Link a reversal's own movement rows back to the transferId they undo.
ALTER TABLE "stock_movements" ADD COLUMN "reversedTransferId" TEXT;
ALTER TABLE "ingredient_movements" ADD COLUMN "reversedTransferId" TEXT;
