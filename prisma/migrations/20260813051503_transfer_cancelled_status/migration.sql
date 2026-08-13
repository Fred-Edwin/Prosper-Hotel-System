-- AlterEnum
ALTER TYPE "TransferStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByStaffMemberId" TEXT;
