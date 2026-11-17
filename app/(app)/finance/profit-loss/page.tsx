import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { Percent, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PnlTrend } from "@/components/finance/charts";
import { PageHeader } from "@/components/shared/page-header";
import { DateParam } from "@/components/shared/url-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { formatLocal } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { pnlTrend, profitAndLoss, type PnlParams } from "@/server/queries/finance";

export async function generateMetadata() {
  return { title: (await getT())("Profit & Loss") };
}

const RANGES = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd", label: "Year to date" },
  { key: "custom", label: "Custom" },
];

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<PnlParams> }) {
  const t = await getT();
  await requirePagePermission("finance:view");
  const params = await searchParams;
  const [pnl, trend] = await Promise.all([profitAndLoss(params), pnlTrend(params.basis === "accrual" ? "accrual" : "cash", t.lang)]);
  const href = (patch: Partial<PnlParams>) => `?${new URLSearchParams(Object.entries({ ...params, ...patch }).filter((e): e is [string, string] => !!e[1]))}`;
  const loss = pnl.net.isNegative();

  return (
    <>
      <PageHeader
        title={t("Profit & Loss")}
        description={t("{date} – {date2} · all figures net of VAT", { date: formatLocal(pnl.range.start, "d MMM yyyy", t.lang), date2: formatLocal(pnl.range.end, "d MMM yyyy", t.lang) })}
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Segmented
          label={t("Period")}
          items={RANGES.map((r) => ({ key: r.key, label: t(r.label), href: href({ range: r.key === "month" ? undefined : r.key }) }))}
          active={pnl.range.key}
        />
        <Segmented
          label={t("Basis")}
          items={[
            { key: "cash", label: t("Collected (cash)"), href: href({ basis: undefined }) },
            { key: "accrual", label: t("Invoiced (accrual)"), href: href({ basis: "accrual" }) },
          ]}
          active={pnl.basis}
        />
        {pnl.range.key === "custom" && (
          <>
            <DateParam param="from" label={t("From")} />
            <DateParam param="to" label={t("to")} />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Income")} value={formatMoney(pnl.income)} sub={pnl.basis === "cash" ? t("Payments received, VAT removed") : t("Invoices issued, before VAT")} icon={Wallet} />
        <StatCard label={t("Expenses")} value={formatMoney(pnl.expenses)} sub={t("All categories, before VAT")} icon={Receipt} />
        <StatCard
          label={loss ? t("Net loss") : t("Net profit")}
          value={<span className={loss ? "text-destructive" : undefined}>{formatMoney(pnl.net)}</span>}
          sub={t("Income − expenses")}
          icon={loss ? TrendingDown : TrendingUp}
        />
        <StatCard label={t("Margin")} value={pnl.marginPct === null ? "—" : `${pnl.marginPct}%`} sub={t("Net as % of income")} icon={Percent} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="bg-card rounded-xl border p-5 xl:col-span-2">
          <h2 className="font-medium">{t("12-month trend")}</h2>
          <p className="text-muted-foreground mb-3 text-xs">{pnl.basis === "cash" ? t("Collected income vs expenses, QAR") : t("Invoiced income vs expenses, QAR")}</p>
          <PnlTrend data={trend} />
        </section>

        <section className="bg-card rounded-xl border">
          <h2 className="px-5 pt-4 font-medium">{t("Statement")}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("Line")}</TableHead>
                <TableHead className="pe-5 text-end">{t("QAR")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-medium">
                <TableCell className="ps-5">{t("Income")}</TableCell>
                <TableCell className="pe-5 text-end tabular-nums">{formatMoney(pnl.income)}</TableCell>
              </TableRow>
              {pnl.byCategory.map((c) => (
                <TableRow key={c.category}>
                  <TableCell className="text-muted-foreground ps-8">{t(EXPENSE_CATEGORY_LABEL[c.category])}</TableCell>
                  <TableCell className="pe-5 text-end tabular-nums">({formatMoney(c.amount)})</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell className="ps-5">{t("Total expenses")}</TableCell>
                <TableCell className="pe-5 text-end tabular-nums">({formatMoney(pnl.expenses)})</TableCell>
              </TableRow>
              <TableRow className={cn("border-t-2 font-semibold", loss && "text-destructive")}>
                <TableCell className="ps-5">{loss ? t("Net loss") : t("Net profit")}</TableCell>
                <TableCell className="pe-5 text-end tabular-nums">{formatMoney(pnl.net)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="text-muted-foreground space-y-1 border-t px-5 py-3 text-xs">
            <div className="flex justify-between">
              <span>{pnl.basis === "cash" ? t("Output VAT (collected)") : t("Output VAT (invoiced)")}</span>
              <span className="tabular-nums">{formatMoney(pnl.vatCollected)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("Input VAT on expenses")}</span>
              <span className="tabular-nums">{formatMoney(pnl.inputVat)}</span>
            </div>
            <p className="pt-1">
              {t("VAT is excluded from profit. See")}{" "}
              <Link href="/reports" className="underline">
                {t("Reports")}</Link>{" "}
              {t("for the VAT return summary.")}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Segmented({ label, items, active }: { label: string; items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label={label} className="bg-muted inline-flex w-fit flex-wrap rounded-lg p-[3px]">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === active ? "page" : undefined}
          className={cn("inline-flex h-7 items-center rounded-md px-2.5 text-sm font-medium", i.key === active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
