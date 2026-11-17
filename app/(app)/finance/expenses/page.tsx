import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { Paperclip, Pencil, Plus } from "lucide-react";
import { MonthlyBars } from "@/components/finance/charts";
import { DeleteExpenseButton, ExpenseDialog } from "@/components/finance/expense-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { DateParam, FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { EXPENSE_PAGE_SIZE, expenseTrend, listExpenses, type ExpenseParams } from "@/server/queries/finance";

export async function generateMetadata() {
  return { title: (await getT())("Expenses") };
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseParams> }) {
  const t = await getT();
  const user = await requirePagePermission("finance:view");
  const params = await searchParams;
  const canEdit = can(user.role, "finance:edit");
  const [{ rows, total, page, sums, byCategory }, trend, vendors] = await Promise.all([
    listExpenses(params),
    expenseTrend(t.lang),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.amount.toNumber()));
  const filtered = !!(params.category || params.from || params.to || params.q);

  return (
    <>
      <PageHeader
        title={t("Expenses")}
        description={t("Office costs by category. Freelancer payments arrive automatically from Outsourced work.")}
        actions={
          canEdit && (
            <ExpenseDialog vendors={vendors} defaults={{ category: "SUPPLIES", amount: "", vatAmount: "", description: "", date: toDateInput(new Date()), vendorId: "" }}>
              <Button>
                <Plus /> {t("Record expense")}</Button>
            </ExpenseDialog>
          )
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">{t("Monthly expenses")}</h2>
          <p className="text-muted-foreground mb-3 text-xs">{t("Last 6 months, QAR excl. VAT")}</p>
          <MonthlyBars data={trend} label={t("Expenses")} />
        </section>
        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">{t("By category")}</h2>
          <p className="text-muted-foreground mb-3 text-xs">{t("{value} · {amount} + {amount2} VAT", { value: filtered ? "Matching the filters below" : "All time", amount: formatMoney(sums.amount), amount2: formatMoney(sums.vat) })}</p>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("No expenses.")}</p>
          ) : (
            <ul className="space-y-2.5">
              {byCategory.map((c) => (
                <li key={c.category} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{t(EXPENSE_CATEGORY_LABEL[c.category])}</span>
                    <span className="tabular-nums">{formatMoney(c.amount)}</span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 rounded-full" aria-hidden>
                    <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(c.amount.toNumber() / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput placeholder={t("Description or vendor")} />
        <FilterSelect param="category" label={t("Category")} allLabel={t("All categories")} options={Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
        <DateParam param="from" label={t("From")} />
        <DateParam param="to" label={t("to")} />
      </div>

      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">{t("No expenses match these filters.")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Date")}</TableHead>
                <TableHead>{t("Description")}</TableHead>
                <TableHead>{t("Category")}</TableHead>
                <TableHead className="text-end">{t("Amount")}</TableHead>
                <TableHead className="text-end">{t("VAT")}</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const wo = e.outsourcedWork?.workOrder;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="ps-4 text-sm whitespace-nowrap">{formatDate(e.date, t.lang)}</TableCell>
                    <TableCell className="max-w-96 whitespace-normal">
                      <div>{e.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {e.vendor?.name}
                        {wo && (
                          <>
                            {" "}
                            · {t("from outsourcing")}{" "}
                            <Link href={`/work-orders/${wo.id}`} className="font-mono hover:underline">
                              {wo.orderNo}
                            </Link>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t(EXPENSE_CATEGORY_LABEL[e.category])}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(e.amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-end tabular-nums">{e.vatAmount.isZero() ? "—" : formatMoney(e.vatAmount)}</TableCell>
                    <TableCell className="pe-4">
                      <div className="flex justify-end gap-1">
                        {e.receiptUrl && (
                          <Button size="icon-sm" variant="ghost" asChild>
                            <a href={e.receiptUrl} target="_blank" rel="noopener" aria-label={t("Receipt for {description}", { description: e.description })}>
                              <Paperclip />
                            </a>
                          </Button>
                        )}
                        {canEdit && !e.outsourcedWorkId && (
                          <>
                            <ExpenseDialog
                              expenseId={e.id}
                              vendors={vendors}
                              hasReceipt={!!e.receiptUrl}
                              defaults={{
                                category: e.category,
                                amount: e.amount.toFixed(2),
                                vatAmount: e.vatAmount.toFixed(2),
                                description: e.description,
                                date: toDateInput(e.date),
                                vendorId: e.vendorId ?? "",
                              }}
                            >
                              <Button size="icon-sm" variant="ghost" aria-label={t("Edit {description}", { description: e.description })}>
                                <Pencil />
                              </Button>
                            </ExpenseDialog>
                            <DeleteExpenseButton id={e.id} label={e.description} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={EXPENSE_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}
