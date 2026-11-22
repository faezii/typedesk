-- Centers (organizations). Every business table gets organizationId; existing data becomes the first center.
-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- The data already in this database is the first center (only when there is data).
INSERT INTO "Organization" ("id", "name", "status", "createdAt", "updatedAt")
SELECT 'org_first_center', COALESCE((SELECT "value" FROM "Setting" WHERE "key" = 'companyName' AND "value" <> ''), 'My center'), 'ACTIVE', now(), now()
WHERE EXISTS (SELECT 1 FROM "User");

-- DropIndex
DROP INDEX "Invoice_invoiceNo_key";

-- DropIndex
DROP INDEX "Quotation_quoteNo_key";

-- DropIndex
DROP INDEX "WorkOrder_orderNo_key";

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Counter" DROP CONSTRAINT "Counter_pkey",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center',
ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("organizationId", "key");

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "OutsourcedWork" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "QuotationItem" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center',
ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("organizationId", "key");

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "TranslationDetail" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';

-- AlterTable
ALTER TABLE "WorkOrderRevision" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_first_center';


-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Expense_organizationId_idx" ON "Expense"("organizationId");

-- CreateIndex
CREATE INDEX "FollowUp_organizationId_idx" ON "FollowUp"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNo_key" ON "Invoice"("organizationId", "invoiceNo");

-- CreateIndex
CREATE INDEX "InvoiceItem_organizationId_idx" ON "InvoiceItem"("organizationId");

-- CreateIndex
CREATE INDEX "OutsourcedWork_organizationId_idx" ON "OutsourcedWork"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_organizationId_quoteNo_key" ON "Quotation"("organizationId", "quoteNo");

-- CreateIndex
CREATE INDEX "QuotationItem_organizationId_idx" ON "QuotationItem"("organizationId");

-- CreateIndex
CREATE INDEX "Service_organizationId_idx" ON "Service"("organizationId");

-- CreateIndex
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");

-- CreateIndex
CREATE INDEX "TranslationDetail_organizationId_idx" ON "TranslationDetail"("organizationId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Vendor_organizationId_idx" ON "Vendor"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_orderNo_key" ON "WorkOrder"("organizationId", "orderNo");

-- CreateIndex
CREATE INDEX "WorkOrderRevision_organizationId_idx" ON "WorkOrderRevision"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderRevision" ADD CONSTRAINT "WorkOrderRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationDetail" ADD CONSTRAINT "TranslationDetail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourcedWork" ADD CONSTRAINT "OutsourcedWork_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- From now on a row must be given its center explicitly ('' fails the foreign key).
ALTER TABLE "User" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Counter" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Customer" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Document" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Expense" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "FollowUp" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "InvoiceItem" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "OutsourcedWork" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Quotation" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "QuotationItem" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Service" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Setting" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Task" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "TranslationDetail" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "Vendor" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "WorkOrder" ALTER COLUMN "organizationId" SET DEFAULT '';
ALTER TABLE "WorkOrderRevision" ALTER COLUMN "organizationId" SET DEFAULT '';

-- Everyone who could already sign in counts as verified.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- A row may only point at rows of its own center (e.g. a work order at a customer). Checked inside the
-- writing transaction, so rows created earlier in the same transaction count. Prisma doesn't manage
-- triggers: a migration that adds a relation between business tables must add its trigger too.
CREATE FUNCTION same_center_fk() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ref text := to_jsonb(NEW) ->> TG_ARGV[0];
  ref_center text;
BEGIN
  IF ref IS NOT NULL THEN
    EXECUTE format('SELECT "organizationId" FROM %I WHERE id = $1', TG_ARGV[1]) INTO ref_center USING ref;
    IF ref_center IS DISTINCT FROM NEW."organizationId" THEN
      RAISE EXCEPTION '%.% points at % % of another center', TG_TABLE_NAME, TG_ARGV[0], TG_ARGV[1], ref
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "WorkOrder_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "WorkOrder" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "WorkOrder_serviceId_same_center" BEFORE INSERT OR UPDATE OF "serviceId", "organizationId" ON "WorkOrder" FOR EACH ROW EXECUTE FUNCTION same_center_fk('serviceId', 'Service');
CREATE TRIGGER "WorkOrder_assignedToId_same_center" BEFORE INSERT OR UPDATE OF "assignedToId", "organizationId" ON "WorkOrder" FOR EACH ROW EXECUTE FUNCTION same_center_fk('assignedToId', 'User');
CREATE TRIGGER "WorkOrderRevision_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "WorkOrderRevision" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "WorkOrderRevision_requestedById_same_center" BEFORE INSERT OR UPDATE OF "requestedById", "organizationId" ON "WorkOrderRevision" FOR EACH ROW EXECUTE FUNCTION same_center_fk('requestedById', 'User');
CREATE TRIGGER "WorkOrderRevision_resolvedById_same_center" BEFORE INSERT OR UPDATE OF "resolvedById", "organizationId" ON "WorkOrderRevision" FOR EACH ROW EXECUTE FUNCTION same_center_fk('resolvedById', 'User');
CREATE TRIGGER "TranslationDetail_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "TranslationDetail" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "Task_assignedToId_same_center" BEFORE INSERT OR UPDATE OF "assignedToId", "organizationId" ON "Task" FOR EACH ROW EXECUTE FUNCTION same_center_fk('assignedToId', 'User');
CREATE TRIGGER "Task_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "Task" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "OutsourcedWork_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "OutsourcedWork" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "OutsourcedWork_vendorId_same_center" BEFORE INSERT OR UPDATE OF "vendorId", "organizationId" ON "OutsourcedWork" FOR EACH ROW EXECUTE FUNCTION same_center_fk('vendorId', 'Vendor');
CREATE TRIGGER "Document_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "Document" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "Document_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "Document" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "Document_outsourcedWorkId_same_center" BEFORE INSERT OR UPDATE OF "outsourcedWorkId", "organizationId" ON "Document" FOR EACH ROW EXECUTE FUNCTION same_center_fk('outsourcedWorkId', 'OutsourcedWork');
CREATE TRIGGER "Document_uploadedById_same_center" BEFORE INSERT OR UPDATE OF "uploadedById", "organizationId" ON "Document" FOR EACH ROW EXECUTE FUNCTION same_center_fk('uploadedById', 'User');
CREATE TRIGGER "FollowUp_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "FollowUp" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "FollowUp_invoiceId_same_center" BEFORE INSERT OR UPDATE OF "invoiceId", "organizationId" ON "FollowUp" FOR EACH ROW EXECUTE FUNCTION same_center_fk('invoiceId', 'Invoice');
CREATE TRIGGER "FollowUp_assignedToId_same_center" BEFORE INSERT OR UPDATE OF "assignedToId", "organizationId" ON "FollowUp" FOR EACH ROW EXECUTE FUNCTION same_center_fk('assignedToId', 'User');
CREATE TRIGGER "Quotation_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "Quotation" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "QuotationItem_quotationId_same_center" BEFORE INSERT OR UPDATE OF "quotationId", "organizationId" ON "QuotationItem" FOR EACH ROW EXECUTE FUNCTION same_center_fk('quotationId', 'Quotation');
CREATE TRIGGER "QuotationItem_serviceId_same_center" BEFORE INSERT OR UPDATE OF "serviceId", "organizationId" ON "QuotationItem" FOR EACH ROW EXECUTE FUNCTION same_center_fk('serviceId', 'Service');
CREATE TRIGGER "Invoice_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "Invoice" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "Invoice_quotationId_same_center" BEFORE INSERT OR UPDATE OF "quotationId", "organizationId" ON "Invoice" FOR EACH ROW EXECUTE FUNCTION same_center_fk('quotationId', 'Quotation');
CREATE TRIGGER "InvoiceItem_invoiceId_same_center" BEFORE INSERT OR UPDATE OF "invoiceId", "organizationId" ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION same_center_fk('invoiceId', 'Invoice');
CREATE TRIGGER "InvoiceItem_serviceId_same_center" BEFORE INSERT OR UPDATE OF "serviceId", "organizationId" ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION same_center_fk('serviceId', 'Service');
CREATE TRIGGER "InvoiceItem_workOrderId_same_center" BEFORE INSERT OR UPDATE OF "workOrderId", "organizationId" ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION same_center_fk('workOrderId', 'WorkOrder');
CREATE TRIGGER "Payment_invoiceId_same_center" BEFORE INSERT OR UPDATE OF "invoiceId", "organizationId" ON "Payment" FOR EACH ROW EXECUTE FUNCTION same_center_fk('invoiceId', 'Invoice');
CREATE TRIGGER "Payment_customerId_same_center" BEFORE INSERT OR UPDATE OF "customerId", "organizationId" ON "Payment" FOR EACH ROW EXECUTE FUNCTION same_center_fk('customerId', 'Customer');
CREATE TRIGGER "Payment_receivedById_same_center" BEFORE INSERT OR UPDATE OF "receivedById", "organizationId" ON "Payment" FOR EACH ROW EXECUTE FUNCTION same_center_fk('receivedById', 'User');
CREATE TRIGGER "Expense_vendorId_same_center" BEFORE INSERT OR UPDATE OF "vendorId", "organizationId" ON "Expense" FOR EACH ROW EXECUTE FUNCTION same_center_fk('vendorId', 'Vendor');
CREATE TRIGGER "Expense_outsourcedWorkId_same_center" BEFORE INSERT OR UPDATE OF "outsourcedWorkId", "organizationId" ON "Expense" FOR EACH ROW EXECUTE FUNCTION same_center_fk('outsourcedWorkId', 'OutsourcedWork');
CREATE TRIGGER "ActivityLog_userId_same_center" BEFORE INSERT OR UPDATE OF "userId", "organizationId" ON "ActivityLog" FOR EACH ROW EXECUTE FUNCTION same_center_fk('userId', 'User');
