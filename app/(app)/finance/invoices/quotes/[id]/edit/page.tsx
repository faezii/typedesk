import { getT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { DocumentBuilder } from "@/components/finance/document-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { getQuotation, serviceOptions } from "@/server/queries/invoices";

export async function generateMetadata() {
  return { title: (await getT())("Edit quotation") };
}

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  await requirePagePermission("finance:edit");
  const q = await getQuotation((await params).id);
  if (!q) notFound();
  if (q.status === "CONVERTED") redirect(`/finance/invoices/quotes/${q.id}`);
  const services = await serviceOptions();

  return (
    <>
      <PageHeader title={t("Edit {quoteNo}", { quoteNo: q.quoteNo })} />
      <DocumentBuilder
        kind="quotation"
        docId={q.id}
        services={services}
        vatRate={q.vatRate.toString()}
        defaultCustomer={{ id: q.customer.id, name: q.customer.name }}
        defaultValues={{
          customerId: q.customerId,
          issueDate: toDateInput(q.issueDate),
          dueDate: toDateInput(q.validUntil),
          notes: q.notes ?? "",
          items: q.items.map((i) => ({ description: i.description, serviceId: i.serviceId ?? "", workOrderId: "", quantity: i.quantity.toString(), unitPrice: i.unitPrice.toFixed(2) })),
        }}
      />
    </>
  );
}
