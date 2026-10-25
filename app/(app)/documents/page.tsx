import { Upload } from "lucide-react";
import { DocumentTable } from "@/components/documents/document-table";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/labels";
import { DOC_PAGE_SIZE, listDocuments, type DocumentListParams } from "@/server/queries/documents";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<DocumentListParams> }) {
  const user = await requirePagePermission("documents:view");
  const params = await searchParams;
  const { rows, total, page } = await listDocuments(params);
  const canEdit = can(user.role, "documents:edit");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Passports, QIDs, trade licenses and job files, linked to customers and work orders."
        actions={
          canEdit && (
            <UploadDialog>
              <Button>
                <Upload /> Upload
              </Button>
            </UploadDialog>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput placeholder="Document, customer or WO number" />
        <FilterSelect
          param="category"
          label="Category"
          allLabel="All categories"
          options={Object.entries(DOCUMENT_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="bg-card rounded-xl border">
        <DocumentTable
          rows={rows}
          canDelete={canEdit}
          emptyText={params.q || params.category ? "No documents match these filters." : "No documents uploaded yet."}
        />
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={DOC_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}
