-- CreateEnum
CREATE TYPE "LocationCode" AS ENUM ('restaurant', 'canteen');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('owner', 'store_manager', 'cashier', 'attendant');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "code" "LocationCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "locationId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_phone_key" ON "staff_members"("phone");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
