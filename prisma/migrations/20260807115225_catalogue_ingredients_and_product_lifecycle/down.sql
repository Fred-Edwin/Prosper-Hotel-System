-- DropIndex
DROP INDEX "products_name_key";

-- DropTable
DROP TABLE "ingredients";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "active",
DROP COLUMN "priceMinor";
