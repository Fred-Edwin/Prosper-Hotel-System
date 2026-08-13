-- DropForeignKey
ALTER TABLE "takings" DROP CONSTRAINT "takings_locationId_fkey";

-- DropForeignKey
ALTER TABLE "takings" DROP CONSTRAINT "takings_staffMemberId_fkey";

-- AlterTable
ALTER TABLE "handovers" ALTER COLUMN "expectedMpesaMinor" DROP NOT NULL;

-- DropTable
DROP TABLE "takings";
