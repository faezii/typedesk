import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, Printer } from "lucide-react";
import { ConvertQuotationButton, QuotationStatusSelect } from "@/components/finance/invoice-actions";
import { QuoteStatusBadge } from "@/components/finance/status-badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney, formatDate } from "@/lib/format";
import { getQuotation } from "@/server/queries/invoices";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getQuotation((await params).id))?.quoteNo ?? (await getT())("Quotation") };
}

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await requirePagePermission("finance:view");
  const q = await getQuotation((await params).id);
  if (!q) notFound();
  const canEdit = can(user.role, "finance:edit");
  const converted = q.status === "CONVERTED";
  const pdf = `/api/finance/quotation/${q.id}/pdf`;

  return (
    <>
      <Link href="/finance/invoices?tab=quotes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="rtl:-scale-x-100 size-4" /> {t("Quotations")}</Link>
      <section className="bg-card mb-4 rounded-xl border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold">{q.quoteNo}</h1>
              <QuoteStatusBadge status={q.status} />
            </div>
            <div className="mt-1 text-sm">
              <Link href={`/customers/${q.customer.id}`} className="font-medium hover:underline">
                {q.customer.companyName ?? q.customer.name}
              </Link>
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {t("{date} · Valid until {date2}", { date: formatDate(q.issueDate, t.lang), date2: formatDate(q.validUntil, t.lang) })}
              {q.invoices.map((i) => (
                <span key={i.id}>
                  {" · "}
                  {t("Invoiced as")}{" "}
                  <Link href={`/finance/invoices/${i.id}`} className="font-mono hover:underline">
                    {i.invoiceNo}
                  </Link>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !converted && (
              <>
                <QuotationStatusSelect id={q.id} status={q.status} />
                <ConvertQuotationButton id={q.id} />
                <Button variant="outline" asChild>
                  <Link href={`/finance/invoices/quotes/${q.id}/edit`}>
                    <Pencil /> {t("Edit")}</Link>
                </Button>
              </>
            )}
            <Button variant="outline" asChild>
              <a href={pdf} target="_blank" rel="noopener">
                <Printer /> {t("View / print")}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${pdf}?download`}>
                <Download /> {t("PDF")}</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-card rounded-xl border">
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
            {q.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="ps-5 whitespace-normal">{it.description}</TableCell>
                <TableCell className="text-end tabular-nums">{it.quantity.toString()}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(it.unitPrice)}</TableCell>
                <TableCell className="pe-5 text-end tabular-nums">{formatMoney(it.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="ms-auto w-full max-w-xs space-y-1.5 border-t px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("Subtotal")}</dt>
            <dd className="tabular-nums">{formatMoney(q.subtotal)}</dd>
          </div>
          {!q.vatRate.isZero() && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("VAT {value}%", { value: q.vatRate.times(100).toDecimalPlaces(2).toString() })}</dt>
              <dd className="tabular-nums">{formatMoney(q.vatAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
            <dt>{t("Total")}</dt>
            <dd className="tabular-nums">{formatMoney(q.totalAmount)}</dd>
          </div>
        </dl>
        {q.notes && <p className="border-t px-5 py-3 text-sm whitespace-pre-wrap">{q.notes}</p>}
      </section>
    </>
  );
}
