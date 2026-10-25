import { notFound, redirect } from "next/navigation";
import { DocumentBuilder } from "@/components/finance/document-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { getInvoice, serviceOptions } from "@/server/queries/invoices";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("finance:edit");
  const inv = await getInvoice((await params).id);
  if (!inv) notFound();
  // Paid or cancelled invoices are locked; send people back to the read-only view.
  if (inv.status === "CANCELLED" || inv.amountPaid.gt(0)) redirect(`/finance/invoices/${inv.id}`);
  const services = await serviceOptions();

  return (
    <>
      <PageHeader title={`Edit ${inv.invoiceNo}`} description="Only invoices without payments can be edited." />
      <DocumentBuilder
        kind="invoice"
        docId={inv.id}
        services={services}
        vatRate={inv.vatRate.toString()}
        defaultCustomer={{ id: inv.customer.id, name: inv.customer.name }}
        defaultValues={{
          customerId: inv.customerId,
          issueDate: toDateInput(inv.issueDate),
          dueDate: toDateInput(inv.dueDate),
          notes: inv.notes ?? "",
          items: inv.items.map((i) => ({
            description: i.description,
            serviceId: i.serviceId ?? "",
            workOrderId: i.workOrderId ?? "",
            quantity: i.quantity.toString(),
            unitPrice: i.unitPrice.toFixed(2),
          })),
        }}
      />
    </>
  );
}
