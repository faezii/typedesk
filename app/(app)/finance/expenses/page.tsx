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

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseParams> }) {
  const user = await requirePagePermission("finance:view");
  const params = await searchParams;
  const canEdit = can(user.role, "finance:edit");
  const [{ rows, total, page, sums, byCategory }, trend, vendors] = await Promise.all([
    listExpenses(params),
    expenseTrend(),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.amount.toNumber()));
  const filtered = !!(params.category || params.from || params.to || params.q);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Office costs by category. Freelancer payments arrive automatically from Outsourced work."
        actions={
          canEdit && (
            <ExpenseDialog vendors={vendors} defaults={{ category: "SUPPLIES", amount: "", vatAmount: "", description: "", date: toDateInput(new Date()), vendorId: "" }}>
              <Button>
                <Plus /> Record expense
              </Button>
            </ExpenseDialog>
          )
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">Monthly expenses</h2>
          <p className="text-muted-foreground mb-3 text-xs">Last 6 months, QAR excl. VAT</p>
          <MonthlyBars data={trend} label="Expenses" />
        </section>
        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">By category</h2>
          <p className="text-muted-foreground mb-3 text-xs">
            {filtered ? "Matching the filters below" : "All time"} · {formatMoney(sums.amount)} + {formatMoney(sums.vat)} VAT
          </p>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No expenses.</p>
          ) : (
            <ul className="space-y-2.5">
              {byCategory.map((c) => (
                <li key={c.category} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{EXPENSE_CATEGORY_LABEL[c.category]}</span>
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
        <SearchInput placeholder="Description or vendor" />
        <FilterSelect param="category" label="Category" allLabel="All categories" options={Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
        <DateParam param="from" label="From" />
        <DateParam param="to" label="to" />
      </div>

      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">No expenses match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const wo = e.outsourcedWork?.workOrder;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4 text-sm whitespace-nowrap">{formatDate(e.date)}</TableCell>
                    <TableCell className="max-w-96 whitespace-normal">
                      <div>{e.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {e.vendor?.name}
                        {wo && (
                          <>
                            {" "}
                            · from outsourcing{" "}
                            <Link href={`/work-orders/${wo.id}`} className="font-mono hover:underline">
                              {wo.orderNo}
                            </Link>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{EXPENSE_CATEGORY_LABEL[e.category]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(e.amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">{e.vatAmount.isZero() ? "—" : formatMoney(e.vatAmount)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        {e.receiptUrl && (
                          <Button size="icon-sm" variant="ghost" asChild>
                            <a href={e.receiptUrl} target="_blank" rel="noopener" aria-label={`Receipt for ${e.description}`}>
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
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.description}`}>
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
