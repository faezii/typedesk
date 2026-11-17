import { getT } from "@/lib/i18n/server";
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

export async function generateMetadata() {
  return { title: (await getT())("Payments") };
}

const METHODS: { method: PaymentMethod; Icon: typeof Wallet }[] = [
  { method: "CASH", Icon: Banknote },
  { method: "CARD", Icon: CreditCard },
  { method: "BANK_TRANSFER", Icon: Landmark },
  { method: "ONLINE", Icon: Globe },
];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<PaymentParams> }) {
  const t = await getT();
  await requirePagePermission("finance:view");
  const params = await searchParams;
  const [{ rows, total, page, byMethod }, daily] = await Promise.all([listPayments(params), dailyCollection(params.day, t.lang)]);
  const filtered = !!(params.method || params.from || params.to || params.q);

  return (
    <>
      <PageHeader title={t("Payments & Collections")} description={t("Every payment received against invoices, by method and by day.")} />

      <section className="bg-card mb-6 rounded-xl border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-medium">{t("Daily collection")}</h2>
            <p className="text-muted-foreground text-sm">
              {daily.label} · {daily.count === 1 ? t("1 payment") : t("{count} payments", { count: daily.count })} · <span className="text-foreground font-semibold tabular-nums">{formatMoney(daily.total)}</span>
            </p>
          </div>
          <DateParam param="day" label={t("Day")} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <dl className="grid grid-cols-2 gap-2">
            {METHODS.map(({ method, Icon }) => (
              <div key={method} className="bg-muted/40 rounded-lg border p-3">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Icon className="size-3.5" /> {t(PAYMENT_METHOD_LABEL[method])}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatMoney(daily.byMethod[method]?.amount ?? 0)}</dd>
              </div>
            ))}
          </dl>
          {daily.byStaff.length === 0 ? (
            <p className="text-muted-foreground grid place-items-center rounded-lg border border-dashed p-6 text-sm">{t("No payments on this day.")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Received by")}</TableHead>
                  {METHODS.map(({ method }) => (
                    <TableHead key={method} className="text-end">
                      {t(PAYMENT_METHOD_LABEL[method])}
                    </TableHead>
                  ))}
                  <TableHead className="text-end">{t("Total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.byStaff.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    {METHODS.map(({ method }) => (
                      <TableCell key={method} className="text-end tabular-nums">
                        {s.methods[method] ? formatMoney(s.methods[method]!) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-end font-medium tabular-nums">{formatMoney(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput placeholder={t("Invoice, customer or reference")} />
        <FilterSelect param="method" label={t("Method")} allLabel={t("All methods")} options={METHODS.map(({ method }) => ({ value: method, label: t(PAYMENT_METHOD_LABEL[method]) }))} />
        <DateParam param="from" label={t("From")} />
        <DateParam param="to" label={t("to")} />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METHODS.map(({ method, Icon }) => (
          <StatCard
            key={method}
            label={t(PAYMENT_METHOD_LABEL[method])}
            value={formatMoney(byMethod[method]?.amount ?? 0)}
            sub={filtered ? t("{count} payments (filtered)", { count: byMethod[method]?.count ?? 0 }) : t("{count} payments, all time", { count: byMethod[method]?.count ?? 0 })}
            icon={Icon}
          />
        ))}
      </div>

      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">{t("No payments match these filters.")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Date")}</TableHead>
                <TableHead>{t("Invoice")}</TableHead>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead>{t("Method")}</TableHead>
                <TableHead>{t("Reference")}</TableHead>
                <TableHead>{t("Received by")}</TableHead>
                <TableHead className="pe-4 text-end">{t("Amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="ps-4 text-sm">{formatDate(p.date, t.lang)}</TableCell>
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
                  <TableCell className="text-sm">{t(PAYMENT_METHOD_LABEL[p.method])}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.receivedBy?.name ?? "—"}</TableCell>
                  <TableCell className="pe-4 text-end font-medium tabular-nums">{formatMoney(p.amount)}</TableCell>
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
