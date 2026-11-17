import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, Printer } from "lucide-react";
import { CancelInvoiceButton, RecordPaymentDialog, RemovePaymentButton } from "@/components/finance/invoice-actions";
import { InvoiceStatusBadge } from "@/components/finance/status-badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import { amountInWords } from "@/lib/invoice-math";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { getInvoice } from "@/server/queries/invoices";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getInvoice((await params).id))?.invoiceNo ?? (await getT())("Invoice") };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await requirePagePermission("finance:view");
  const inv = await getInvoice((await params).id);
  if (!inv) notFound();
  const canEdit = can(user.role, "finance:edit");
  const balance = inv.totalAmount.minus(inv.amountPaid);
  const open = inv.status === "UNPAID" || inv.status === "PARTIAL";
  const pdf = `/api/finance/invoice/${inv.id}/pdf`;

  return (
    <>
      <Link href="/finance/invoices" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="rtl:-scale-x-100 size-4" /> {t("Invoices")}</Link>

      <section className="bg-card mb-4 rounded-xl border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold">{inv.invoiceNo}</h1>
              <InvoiceStatusBadge status={inv.status} />
            </div>
            <div className="mt-1 text-sm">
              <Link href={`/customers/${inv.customer.id}`} className="font-medium hover:underline">
                {inv.customer.companyName ?? inv.customer.name}
              </Link>
              {inv.customer.taxNo && <span className="text-muted-foreground">{t("· CR / tax no. {taxNo}", { taxNo: inv.customer.taxNo })}</span>}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {t("Issued {date} · Due {date2}", { date: formatDate(inv.issueDate, t.lang), date2: formatDate(inv.dueDate, t.lang) })}
              {inv.quotation && (
                <>
                  {" · "}
                  {t("From")}{" "}
                  <Link href={`/finance/invoices/quotes/${inv.quotation.id}`} className="font-mono hover:underline">
                    {inv.quotation.quoteNo}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && open && <RecordPaymentDialog invoiceId={inv.id} invoiceNo={inv.invoiceNo} balance={balance.toFixed(2)} today={toDateInput(new Date())} />}
            <Button variant="outline" asChild>
              <a href={pdf} target="_blank" rel="noopener">
                <Printer /> {t("View / print")}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${pdf}?download`}>
                <Download /> {t("PDF")}</a>
            </Button>
            {canEdit && inv.amountPaid.isZero() && inv.status !== "CANCELLED" && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/finance/invoices/${inv.id}/edit`}>
                    <Pencil /> {t("Edit")}</Link>
                </Button>
                <CancelInvoiceButton id={inv.id} invoiceNo={inv.invoiceNo} />
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="bg-card rounded-xl border xl:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("Description")}</TableHead>
                <TableHead className="text-end">{t("Qty")}</TableHead>
                <TableHead className="text-end">{t("Rate")}</TableHead>
                <TableHead className="pe-5 text-end">{t("Amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="ps-5 whitespace-normal">
                    {it.description}
                    {it.workOrder && (
                      <Link href={`/work-orders/${it.workOrder.id}`} className="text-muted-foreground ms-1 font-mono text-xs hover:underline">
                        {it.workOrder.orderNo}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{it.quantity.toString()}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMoney(it.unitPrice)}</TableCell>
                  <TableCell className="pe-5 text-end tabular-nums">{formatMoney(it.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <dl className="ms-auto w-full max-w-xs space-y-1.5 border-t px-5 py-4 text-sm">
            <Row label={t("Subtotal")} value={formatMoney(inv.subtotal)} />
            {!inv.vatRate.isZero() && <Row label={t("VAT {value}%", { value: inv.vatRate.times(100).toDecimalPlaces(2).toString() })} value={formatMoney(inv.vatAmount)} />}
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <dt>{t("Total")}</dt>
              <dd className="tabular-nums">{formatMoney(inv.totalAmount)}</dd>
            </div>
            <Row label={t("Paid")} value={formatMoney(inv.amountPaid)} />
            {inv.status !== "CANCELLED" && <Row label={t("Balance due")} value={formatMoney(balance)} strong />}
          </dl>
          <p className="text-muted-foreground border-t px-5 py-3 text-xs">{amountInWords(inv.totalAmount)}</p>
          {inv.notes && <p className="border-t px-5 py-3 text-sm whitespace-pre-wrap">{inv.notes}</p>}
        </section>

        <section className="bg-card rounded-xl border p-5">
          <h2 className="mb-3 font-medium">{t("Payments")}</h2>
          {inv.payments.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("No payments yet.")}</p>
          ) : (
            <ul className="divide-y">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{t(PAYMENT_METHOD_LABEL[p.method])}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatDate(p.date, t.lang)}
                      {p.reference && ` · ${p.reference}`}
                      {p.receivedBy && ` · ${p.receivedBy.name}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="tabular-nums">{formatMoney(p.amount)}</span>
                    {canEdit && <RemovePaymentButton id={p.id} label={t("{amount} on {date}", { amount: formatMoney(p.amount), date: formatDate(p.date, t.lang) })} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
