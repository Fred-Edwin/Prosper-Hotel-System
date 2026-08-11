-- CreateTable
CREATE TABLE "takings" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "cashMinor" INTEGER NOT NULL,
    "mpesaMinor" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "takings" ADD CONSTRAINT "takings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
