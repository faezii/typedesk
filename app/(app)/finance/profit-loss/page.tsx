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

export const metadata = { title: "Profit & Loss" };

const RANGES = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd", label: "Year to date" },
  { key: "custom", label: "Custom" },
];

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<PnlParams> }) {
  await requirePagePermission("finance:view");
  const params = await searchParams;
  const [pnl, trend] = await Promise.all([profitAndLoss(params), pnlTrend(params.basis === "accrual" ? "accrual" : "cash")]);
  const href = (patch: Partial<PnlParams>) => `?${new URLSearchParams(Object.entries({ ...params, ...patch }).filter((e): e is [string, string] => !!e[1]))}`;
  const loss = pnl.net.isNegative();

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        description={`${formatLocal(pnl.range.start, "d MMM yyyy")} – ${formatLocal(pnl.range.end, "d MMM yyyy")} · all figures net of VAT`}
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Segmented
          label="Period"
          items={RANGES.map((r) => ({ key: r.key, label: r.label, href: href({ range: r.key === "month" ? undefined : r.key }) }))}
          active={pnl.range.key}
        />
        <Segmented
          label="Basis"
          items={[
            { key: "cash", label: "Collected (cash)", href: href({ basis: undefined }) },
            { key: "accrual", label: "Invoiced (accrual)", href: href({ basis: "accrual" }) },
          ]}
          active={pnl.basis}
        />
        {pnl.range.key === "custom" && (
          <>
            <DateParam param="from" label="From" />
            <DateParam param="to" label="to" />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Income" value={formatMoney(pnl.income)} sub={pnl.basis === "cash" ? "Payments received, VAT removed" : "Invoices issued, before VAT"} icon={Wallet} />
        <StatCard label="Expenses" value={formatMoney(pnl.expenses)} sub="All categories, before VAT" icon={Receipt} />
        <StatCard
          label={loss ? "Net loss" : "Net profit"}
          value={<span className={loss ? "text-destructive" : undefined}>{formatMoney(pnl.net)}</span>}
          sub="Income − expenses"
          icon={loss ? TrendingDown : TrendingUp}
        />
        <StatCard label="Margin" value={pnl.marginPct === null ? "—" : `${pnl.marginPct}%`} sub="Net as % of income" icon={Percent} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="bg-card rounded-xl border p-5 xl:col-span-2">
          <h2 className="font-medium">12-month trend</h2>
          <p className="text-muted-foreground mb-3 text-xs">{pnl.basis === "cash" ? "Collected" : "Invoiced"} income vs expenses, QAR</p>
          <PnlTrend data={trend} />
        </section>

        <section className="bg-card rounded-xl border">
          <h2 className="px-5 pt-4 font-medium">Statement</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Line</TableHead>
                <TableHead className="pr-5 text-right">QAR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-medium">
                <TableCell className="pl-5">Income</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{formatMoney(pnl.income)}</TableCell>
              </TableRow>
              {pnl.byCategory.map((c) => (
                <TableRow key={c.category}>
                  <TableCell className="text-muted-foreground pl-8">{EXPENSE_CATEGORY_LABEL[c.category]}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">({formatMoney(c.amount)})</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell className="pl-5">Total expenses</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">({formatMoney(pnl.expenses)})</TableCell>
              </TableRow>
              <TableRow className={cn("border-t-2 font-semibold", loss && "text-destructive")}>
                <TableCell className="pl-5">{loss ? "Net loss" : "Net profit"}</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{formatMoney(pnl.net)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="text-muted-foreground space-y-1 border-t px-5 py-3 text-xs">
            <div className="flex justify-between">
              <span>Output VAT ({pnl.basis === "cash" ? "collected" : "invoiced"})</span>
              <span className="tabular-nums">{formatMoney(pnl.vatCollected)}</span>
            </div>
            <div className="flex justify-between">
              <span>Input VAT on expenses</span>
              <span className="tabular-nums">{formatMoney(pnl.inputVat)}</span>
            </div>
            <p className="pt-1">
              VAT is excluded from profit. See{" "}
              <Link href="/reports" className="underline">
                Reports
              </Link>{" "}
              for the VAT return summary.
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
