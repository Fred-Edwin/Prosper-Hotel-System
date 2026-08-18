-- Editable-ledger T11 — drop the superseded backdated-correction columns.
--
-- ADR 0008 replaced the effective-date correction doctrine with in-place
-- editing: the owner edits a figure directly and the change is recorded in
-- the `Amendment` table (migration 20260817151824). These three columns
-- served `recordSaleCorrection`, removed in the same commit as this
-- migration.
--
-- DESTRUCTIVE. Verified before writing, against the dev database:
--
--   * 0 rows with "isCorrection" = true — the mechanism was never used in
--     anger, so no correction record is lost.
--   * Rows where "effectiveAt" <> "occurredAt" are seed artifacts, not
--     data: prisma/seed.ts writes sales through db.sale.create directly
--     rather than createSaleRecord, so "effectiveAt" took its
--     @default(now()) (the seed run time) while "occurredAt" was set
--     explicitly. One such row has "effectiveAt" *earlier* than
--     "occurredAt", which is incoherent for a field meaning "the past day
--     this corrects" — further evidence the value carried no meaning.
--
-- For every sale recorded through the application, "effectiveAt" equalled
-- "occurredAt" (createSaleRecord defaulted it), so Activity now reads
-- "occurredAt" and shows the same instant it always did.
--
-- Not reversible: re-adding the columns restores the defaults, not the
-- values. That is accepted — see ADR 0008's Consequences.

ALTER TABLE "sales" DROP COLUMN "correctionReason",
DROP COLUMN "effectiveAt",
DROP COLUMN "isCorrection";
