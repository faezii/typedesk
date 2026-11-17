import { getT } from "@/lib/i18n/server";
import { addDays } from "date-fns";
import { DocumentBuilder } from "@/components/finance/document-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { zone, toDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAYMENT_DAYS, getSettings } from "@/lib/settings";
import { serviceOptions, uninvoicedWorkOrders } from "@/server/queries/invoices";

export async function generateMetadata() {
  return { title: (await getT())("New document") };
}

/** /finance/invoices/new[?kind=quotation][&customerId=…][&workOrderId=…] */
export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ kind?: string; customerId?: string; workOrderId?: string }> }) {
  const t = await getT();
  await requirePagePermission("finance:edit");
  const { kind: k, customerId, workOrderId } = await searchParams;
  const kind = k === "quotation" ? "quotation" : "invoice";
  const [services, settings] = await Promise.all([serviceOptions(), getSettings()]);

  // "Create invoice" from a work order: prefill its customer and line.
  const wo = workOrderId ? await prisma.workOrder.findFirst({ where: { id: workOrderId, deletedAt: null }, select: { customerId: true } }) : null;
  const custId = wo?.customerId ?? customerId;
  const customer = custId ? await prisma.customer.findFirst({ where: { id: custId, deletedAt: null }, select: { id: true, name: true } }) : null;
  const woLine = wo && workOrderId ? (await uninvoicedWorkOrders(wo.customerId)).find((w) => w.id === workOrderId) : null;

  const today = new Date();
  const due = addDays(today, kind === "invoice" ? DEFAULT_PAYMENT_DAYS : 30, { in: zone });

  return (
    <>
      <PageHeader title={kind === "invoice" ? t("New invoice") : t("New quotation")} description={t("Totals, VAT and the document number are assigned when you save.")} />
      <DocumentBuilder
        kind={kind}
        services={services}
        vatRate={settings.vatRate.toString()}
        defaultCustomer={customer ?? undefined}
        defaultValues={{
          customerId: customer?.id ?? "",
          issueDate: toDateInput(today),
          dueDate: toDateInput(due),
          notes: "",
          items: woLine
            ? [
                {
                  description: `${woLine.service.title}${woLine.notes ? ` — ${woLine.notes.split(" — ")[0]}` : ""} (${woLine.orderNo})`,
                  serviceId: woLine.serviceId,
                  workOrderId: woLine.id,
                  quantity: woLine.quantity.toString(),
                  unitPrice: woLine.unitPrice.toFixed(2),
                },
              ]
            : [{ description: "", serviceId: "", workOrderId: "", quantity: "1", unitPrice: "" }],
        }}
      />
    </>
  );
}
