-- Down migration for 20260806175725_init. Not run automatically — Prisma
-- Migrate is forward-only; this is applied and verified by hand when a
-- rollback is actually needed, per docs/architecture.md's migration policy.

ALTER TABLE "staff_members" DROP CONSTRAINT "staff_members_locationId_fkey";

DROP TABLE "staff_members";
DROP TABLE "locations";

DROP TYPE "StaffRole";
DROP TYPE "LocationCode";
