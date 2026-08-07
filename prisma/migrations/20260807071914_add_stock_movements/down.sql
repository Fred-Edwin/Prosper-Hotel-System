-- Down migration for 20260807071914_add_stock_movements. Not run
-- automatically — Prisma Migrate is forward-only; this is applied and
-- verified by hand when a rollback is actually needed, per
-- docs/architecture.md's migration policy.

ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_staffMemberId_fkey";
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_locationId_fkey";
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_productId_fkey";

DROP TABLE "stock_movements";
DROP TABLE "products";

DROP TYPE "StockMovementReason";
DROP TYPE "ProductKind";
