-- CreateTable
CREATE TABLE "amendments" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "ledgerContext" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "locationId" TEXT,
    "staffMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "amendments_recordType_recordId_idx" ON "amendments"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "amendments_createdAt_idx" ON "amendments"("createdAt");

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
