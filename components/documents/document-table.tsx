import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { FileImage, FileText, FolderOpen } from "lucide-react";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABEL, EXPIRING_CATEGORIES } from "@/lib/labels";
import type { DocumentRow } from "@/server/queries/documents";
import { DocumentActions } from "./document-actions";

const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export async function DocumentTable({
  rows,
  canDelete,
  showCustomer = true,
  emptyText = "No documents yet.",
}: {
  rows: DocumentRow[];
  canDelete: boolean;
  showCustomer?: boolean;
  emptyText?: string;
}) {
  const t = await getT();
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-14 text-center text-sm">
        <FolderOpen className="size-6" />
        {t(emptyText)}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="ps-4">{t("Document")}</TableHead>
          <TableHead>{t("Category")}</TableHead>
          {showCustomer && <TableHead>{t("Customer")}</TableHead>}
          <TableHead>{t("Work order")}</TableHead>
          <TableHead>{t("Expiry")}</TableHead>
          <TableHead>{t("Uploaded")}</TableHead>
          <TableHead className="pe-4 text-end">
            <span className="sr-only">{t("Actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => {
          const Icon = d.mimeType.startsWith("image/") ? FileImage : FileText;
          return (
            <TableRow key={d.id}>
              <TableCell className="max-w-72 ps-4">
                <div className="flex items-center gap-2.5">
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {d.mimeType.split("/").pop()?.replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx").toUpperCase()} ·{" "}
                      {formatSize(d.size)}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <ToneBadge tone="gray">{t(DOCUMENT_CATEGORY_LABEL[d.category])}</ToneBadge>
              </TableCell>
              {showCustomer && (
                <TableCell className="text-sm">
                  {d.customer ? (
                    <Link href={`/customers/${d.customer.id}`} className="hover:underline">
                      {d.customer.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                {d.workOrder ? (
                  <Link href={`/work-orders/${d.workOrder.id}`} className="font-mono text-xs hover:underline">
                    {d.workOrder.orderNo}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                {EXPIRING_CATEGORIES.includes(d.category) ? <ExpiryBadge date={d.expiryDate} showDate /> : <span className="text-muted-foreground text-xs">—</span>}
              </TableCell>
              <TableCell className="text-xs">
                <div>{formatDate(d.createdAt, t.lang)}</div>
                <div className="text-muted-foreground">{d.uploadedBy.name}</div>
              </TableCell>
              <TableCell className="pe-4">
                <DocumentActions doc={d} canDelete={canDelete} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
