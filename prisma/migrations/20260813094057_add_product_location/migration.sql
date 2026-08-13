/*
  Warnings:

  - Added the required column `locationId` to the `products` table without a default value. This is not possible if the table is not empty.

  Backward-compatible against a populated table (docs/architecture.md's
  migration rule): added nullable first, backfilled from each product's
  earliest stock movement (its first real signal of "whose product is
  this"), then any still-unset row falls back to the first location on
  record — same arbitrary-but-harmless default docs/architecture.md's
  "Product home location" note licenses for a product with no movement
  history at all. The owner can correct any wrong default afterward via
  the product form, same as any other field.
*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "locationId" TEXT;

-- Backfill: each product's home location defaults to the location of its
-- earliest stock movement, if it has one.
UPDATE "products" p
SET "locationId" = sub."locationId"
FROM (
  SELECT DISTINCT ON ("productId") "productId", "locationId"
  FROM "stock_movements"
  ORDER BY "productId", "occurredAt" ASC
) sub
WHERE p.id = sub."productId" AND p."locationId" IS NULL;

-- Any remaining product with no movement history at all falls back to the
-- first location on record, purely so NOT NULL can be enforced.
UPDATE "products"
SET "locationId" = (SELECT id FROM "locations" ORDER BY id ASC LIMIT 1)
WHERE "locationId" IS NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "locationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
