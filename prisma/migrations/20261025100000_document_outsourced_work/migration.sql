-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "outsourcedWorkId" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_outsourcedWorkId_fkey" FOREIGN KEY ("outsourcedWorkId") REFERENCES "OutsourcedWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

