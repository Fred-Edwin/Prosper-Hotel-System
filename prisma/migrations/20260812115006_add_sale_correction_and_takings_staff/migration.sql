-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isCorrection" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "takings" ADD COLUMN     "staffMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "takings" ADD CONSTRAINT "takings_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
