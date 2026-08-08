/*
  Warnings:

  - Added the required column `dailyRateMinor` to the `staff_members` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "dailyRateMinor" INTEGER NOT NULL;
