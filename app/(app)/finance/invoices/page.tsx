import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { InvoiceStatusBadge, QuoteStatusBadge } from "@/components/finance/status-badges";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { DateParam, FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { startOfTodayLocal } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INVOICE_PAGE_SIZE, listInvoices, listQuotations, type InvoiceListParams } from "@/server/queries/invoices";

export const metadata = { title: "Invoices & Quotes" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<InvoiceListParams> }) {
  const user = await requirePagePermission("finance:view");
  const params = await searchParams;
  const tab = params.tab === "quotes" ? "quotes" : "invoices";
  const canEdit = can(user.role, "finance:edit");

  return (
    <>
      <PageHeader
        title="Invoices & Quotes"
        description="Invoices and quotations in QAR."
        actions={
          canEdit && (
            <Button asChild>
              <Link href={`/finance/invoices/new${tab === "quotes" ? "?kind=quotation" : ""}`}>
                <Plus /> {tab === "quotes" ? "New quotation" : "New invoice"}
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="bg-muted inline-flex w-fit rounded-lg p-[3px]" role="tablist" aria-label="Documents">
          {[
            { t: "invoices", label: "Invoices", href: "?" },
            { t: "quotes", label: "Quotations", href: "?tab=quotes" },
          ].map(({ t, label, href }) => (
            <Link
              key={t}
              href={href}
              role="tab"
              aria-selected={tab === t}
              className={cn("inline-flex h-7 items-center rounded-md px-3 text-sm font-medium", tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </Link>
          ))}
        </div>
        <SearchInput placeholder={tab === "quotes" ? "QT number or customer" : "INV number or customer"} />
        <FilterSelect
          key={tab}
          param="status"
          label="Status"
          allLabel="All statuses"
          options={
            tab === "quotes"
              ? [
                  { value: "DRAFT", label: "Draft" },
                  { value: "SENT", label: "Sent" },
                  { value: "ACCEPTED", label: "Accepted" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "CONVERTED", label: "Invoiced" },
                ]
              : [
                  { value: "OUTSTANDING", label: "Outstanding (unpaid + partial)" },
                  { value: "UNPAID", label: "Unpaid" },
                  { value: "PARTIAL", label: "Partial" },
                  { value: "PAID", label: "Paid" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]
          }
        />
        <DateParam param="from" label="From" />
        <DateParam param="to" label="to" />
      </div>

      {tab === "quotes" ? <Quotes params={params} /> : <Invoices params={params} />}
    </>
  );
}

async function Invoices({ params }: { params: InvoiceListParams }) {
  const { rows, total, page, sums } = await listInvoices(params);
  const today = startOfTodayLocal();
  const invoiced = sums.totalAmount;
  const collected = sums.amountPaid;
  return (
    <>
      {invoiced && (
        <p className="text-muted-foreground mb-3 text-sm">
          Matching invoices: <span className="text-foreground font-medium tabular-nums">{formatMoney(invoiced)}</span> invoiced ·{" "}
          <span className="text-foreground font-medium tabular-nums">{formatMoney(collected)}</span> collected ·{" "}
          <span className="text-foreground font-medium tabular-nums">{formatMoney(invoiced.minus(collected ?? 0))}</span> outstanding
        </p>
      )}
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <Empty>No invoices match these filters.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-4 text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => {
                const balance = i.totalAmount.minus(i.amountPaid);
                const overdue = i.dueDate && i.dueDate < today && (i.status === "UNPAID" || i.status === "PARTIAL");
                return (
                  <TableRow key={i.id} className="relative">
                    <TableCell className="pl-4">
                      <Link href={`/finance/invoices/${i.id}`} className="font-mono text-[13px] font-medium after:absolute after:inset-0 hover:underline">
                        {i.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{i.customer.name}</TableCell>
                    <TableCell className="text-sm">{formatDate(i.issueDate)}</TableCell>
                    <TableCell className={cn("text-sm", overdue && "text-destructive font-medium")}>{formatDate(i.dueDate)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={i.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(i.totalAmount)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{i.status === "CANCELLED" || balance.isZero() ? "—" : formatMoney(balance)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={INVOICE_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}

async function Quotes({ params }: { params: InvoiceListParams }) {
  const { rows, total, page } = await listQuotations(params);
  return (
    <>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <Empty>No quotations match these filters.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quotation</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id} className="relative">
                  <TableCell className="pl-4">
                    <Link href={`/finance/invoices/quotes/${q.id}`} className="font-mono text-[13px] font-medium after:absolute after:inset-0 hover:underline">
                      {q.quoteNo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{q.customer.name}</TableCell>
                  <TableCell className="text-sm">{formatDate(q.issueDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(q.validUntil)}</TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatMoney(q.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={INVOICE_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
      <FileText className="size-6" />
      {children}
    </div>
  );
}
