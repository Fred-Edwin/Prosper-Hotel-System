-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "expectedCashMinor" INTEGER NOT NULL,
    "expectedMpesaMinor" INTEGER NOT NULL,
    "actualCashMinor" INTEGER NOT NULL,
    "actualMpesaMinor" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
