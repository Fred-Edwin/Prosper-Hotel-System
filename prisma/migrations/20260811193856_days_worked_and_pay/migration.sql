-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "payeeStaffMemberId" TEXT;

-- CreateTable
CREATE TABLE "days_worked" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recordedByStaffMemberId" TEXT NOT NULL,
    "paidAs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "days_worked_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "days_worked_staffMemberId_date_key" ON "days_worked"("staffMemberId", "date");

-- AddForeignKey
ALTER TABLE "days_worked" ADD CONSTRAINT "days_worked_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "days_worked" ADD CONSTRAINT "days_worked_recordedByStaffMemberId_fkey" FOREIGN KEY ("recordedByStaffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payeeStaffMemberId_fkey" FOREIGN KEY ("payeeStaffMemberId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
