-- Link the two signed ledger rows that represent one stock transfer.
ALTER TABLE "stock_movements" ADD COLUMN "transferId" TEXT;
ALTER TABLE "ingredient_movements" ADD COLUMN "transferId" TEXT;
