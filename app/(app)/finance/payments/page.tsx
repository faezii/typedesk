import Link from "next/link";
import { Banknote, CreditCard, Globe, Landmark, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { DateParam, FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { PAYMENT_PAGE_SIZE, dailyCollection, listPayments, type PaymentParams } from "@/server/queries/finance";
import type { PaymentMethod } from "@prisma/client";

export const metadata = { title: "Payments" };

const METHODS: { method: PaymentMethod; Icon: typeof Wallet }[] = [
  { method: "CASH", Icon: Banknote },
  { method: "CARD", Icon: CreditCard },
  { method: "BANK_TRANSFER", Icon: Landmark },
  { method: "ONLINE", Icon: Globe },
];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<PaymentParams> }) {
  await requirePagePermission("finance:view");
  const params = await searchParams;
  const [{ rows, total, page, byMethod }, daily] = await Promise.all([listPayments(params), dailyCollection(params.day)]);
  const filtered = !!(params.method || params.from || params.to || params.q);

  return (
    <>
      <PageHeader title="Payments & Collections" description="Every payment received against invoices, by method and by day." />

      <section className="bg-card mb-6 rounded-xl border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-medium">Daily collection</h2>
            <p className="text-muted-foreground text-sm">
              {daily.label} · {daily.count} payment{daily.count === 1 ? "" : "s"} · <span className="text-foreground font-semibold tabular-nums">{formatMoney(daily.total)}</span>
            </p>
          </div>
          <DateParam param="day" label="Day" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <dl className="grid grid-cols-2 gap-2">
            {METHODS.map(({ method, Icon }) => (
              <div key={method} className="bg-muted/40 rounded-lg border p-3">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Icon className="size-3.5" /> {PAYMENT_METHOD_LABEL[method]}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatMoney(daily.byMethod[method]?.amount ?? 0)}</dd>
              </div>
            ))}
          </dl>
          {daily.byStaff.length === 0 ? (
            <p className="text-muted-foreground grid place-items-center rounded-lg border border-dashed p-6 text-sm">No payments on this day.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received by</TableHead>
                  {METHODS.map(({ method }) => (
                    <TableHead key={method} className="text-right">
                      {PAYMENT_METHOD_LABEL[method]}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.byStaff.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    {METHODS.map(({ method }) => (
                      <TableCell key={method} className="text-right tabular-nums">
                        {s.methods[method] ? formatMoney(s.methods[method]!) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput placeholder="Invoice, customer or reference" />
        <FilterSelect param="method" label="Method" allLabel="All methods" options={METHODS.map(({ method }) => ({ value: method, label: PAYMENT_METHOD_LABEL[method] }))} />
        <DateParam param="from" label="From" />
        <DateParam param="to" label="to" />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METHODS.map(({ method, Icon }) => (
          <StatCard
            key={method}
            label={PAYMENT_METHOD_LABEL[method]}
            value={formatMoney(byMethod[method]?.amount ?? 0)}
            sub={`${byMethod[method]?.count ?? 0} payments${filtered ? " (filtered)" : ", all time"}`}
            icon={Icon}
          />
        ))}
      </div>

      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">No payments match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Received by</TableHead>
                <TableHead className="pr-4 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 text-sm">{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Link href={`/finance/invoices/${p.invoice.id}`} className="font-mono text-[13px] hover:underline">
                      {p.invoice.invoiceNo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                      {p.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.receivedBy?.name ?? "—"}</TableCell>
                  <TableCell className="pr-4 text-right font-medium tabular-nums">{formatMoney(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={PAYMENT_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}
