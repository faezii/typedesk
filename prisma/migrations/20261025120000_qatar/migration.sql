-- Switch from UAE to Qatar: country-neutral names for the national ID and tax number.
-- Renames only, so existing rows keep their values.
ALTER TYPE "DocumentCategory" RENAME VALUE 'EMIRATES_ID' TO 'NATIONAL_ID';
ALTER TYPE "FollowUpType" RENAME VALUE 'EMIRATES_ID_EXPIRY' TO 'NATIONAL_ID_EXPIRY';

ALTER TABLE "Customer" RENAME COLUMN "emiratesId" TO "nationalId";
ALTER TABLE "Customer" RENAME COLUMN "emiratesIdExpiry" TO "nationalIdExpiry";
ALTER TABLE "Customer" RENAME COLUMN "trn" TO "taxNo";
ALTER INDEX "Customer_emiratesId_idx" RENAME TO "Customer_nationalId_idx";

UPDATE "FollowUp" SET "autoKey" = regexp_replace("autoKey", ':emiratesId$', ':nationalId') WHERE "autoKey" LIKE 'customer:%:emiratesId';
UPDATE "Setting" SET "key" = 'companyTaxNo' WHERE "key" = 'companyTrn';

-- Qatar has no VAT today; documents store the rate they were issued with, this is only the column default.
ALTER TABLE "Invoice" ALTER COLUMN "vatRate" SET DEFAULT 0;
ALTER TABLE "Quotation" ALTER COLUMN "vatRate" SET DEFAULT 0;