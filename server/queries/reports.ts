import "server-only";
import { Prisma } from "@prisma/client";
import { startOfYear } from "date-fns";
import { TIMEZONE, zone, endOfTodayLocal, formatLocal, monthsAgoLocal, parseDateInput, startOfMonthLocal } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL, WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { currentOrgId } from "@/lib/auth/session";
import { round2, pct, type ReportResult, type ReportRow } from "@/lib/reports";
import { WORK_ORDER_FLOW } from "@/lib/work-orders";
import { profitAndLoss } from "./finance";

export type ReportParams = { from?: string; to?: string };
type Range = { start: Date; end: Date };
type DefaultRange = "month" | "ytd" | "12m";

export type ReportDef = {
  slug: string;
  title: string;
  description: string;
  group: "Sales" | "Operations" | "Finance";
  defaultRange: DefaultRange;
  run: (range: Range) => Promise<ReportResult>;
};

const n = (v: Prisma.Decimal | number | bigint | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const LIVE_INVOICE = { deletedAt: null, status: { not: "CANCELLED" as const } };

/** Date range from ?from=&to= (yyyy-mm-dd, Doha days), falling back to the report's default period. */
export function reportRange(def: Pick<ReportDef, "defaultRange">, p: ReportParams): Range {
  const end = parseDateInput(p.to) ? endOfTodayLocal(parseDateInput(p.to)!) : endOfTodayLocal();
  const from = parseDateInput(p.from);
  if (from) return { start: from, end };
  if (def.defaultRange === "ytd") return { start: new Date(startOfYear(new Date(), { in: zone }).getTime()), end };
  if (def.defaultRange === "12m") return { start: monthsAgoLocal(11), end };
  return { start: startOfMonthLocal(), end };
}

// ───────────── Sales ─────────────

/** Invoiced (by issue date) and collected (by payment date) grouped by Doha day or month. */
async function salesByPeriod({ start, end }: Range, fmt: "YYYY-MM-DD" | "YYYY-MM"): Promise<ReportResult> {
  const org = await currentOrgId(); // raw SQL isn't center-scoped by lib/prisma
  const [invoiced, collected] = await Promise.all([
    prisma.$queryRaw<{ k: string; cnt: number; sub: Prisma.Decimal; vat: Prisma.Decimal; tot: Prisma.Decimal }[]>(Prisma.sql`
      SELECT to_char(("issueDate" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}, ${fmt}) AS k, count(*)::int AS cnt,
             sum(subtotal) AS sub, sum("vatAmount") AS vat, sum("totalAmount") AS tot
      FROM "Invoice" WHERE "organizationId" = ${org} AND "deletedAt" IS NULL AND status <> 'CANCELLED' AND "issueDate" BETWEEN ${start} AND ${end}
      GROUP BY 1`),
    prisma.$queryRaw<{ k: string; amt: Prisma.Decimal }[]>(Prisma.sql`
      SELECT to_char((p."date" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}, ${fmt}) AS k, sum(p.amount) AS amt
      FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
      WHERE p."organizationId" = ${org} AND i."deletedAt" IS NULL AND p."date" BETWEEN ${start} AND ${end} GROUP BY 1`),
  ]);
  const keys = [...new Set([...invoiced.map((r) => r.k), ...collected.map((r) => r.k)])].sort();
  const inv = new Map(invoiced.map((r) => [r.k, r]));
  const col = new Map(collected.map((r) => [r.k, n(r.amt)]));
  const rows: ReportRow[] = keys.map((k) => ({
    period: k,
    invoices: inv.get(k)?.cnt ?? 0,
    subtotal: n(inv.get(k)?.sub),
    vat: n(inv.get(k)?.vat),
    total: n(inv.get(k)?.tot),
    collected: col.get(k) ?? 0,
  }));
  const sum = (key: string) => round2(rows.reduce((s, r) => s + Number(r[key] ?? 0), 0));
  return {
    columns: [
      { key: "period", label: fmt === "YYYY-MM" ? "Month" : "Date", type: "date" },
      { key: "invoices", label: "Invoices", type: "number" },
      { key: "subtotal", label: "Sales excl. VAT (QAR)", type: "money" },
      { key: "vat", label: "VAT (QAR)", type: "money" },
      { key: "total", label: "Invoiced incl. VAT (QAR)", type: "money" },
      { key: "collected", label: "Collected (QAR)", type: "money" },
    ],
    rows,
    totals: { period: "Total", invoices: sum("invoices"), subtotal: sum("subtotal"), vat: sum("vat"), total: sum("total"), collected: sum("collected") },
    note: "Invoiced figures by invoice date (cancelled invoices excluded); collected by payment date.",
  };
}

async function serviceRevenue({ start, end }: Range): Promise<ReportResult> {
  const groups = await prisma.invoiceItem.groupBy({
    by: ["serviceId"],
    where: { invoice: { ...LIVE_INVOICE, issueDate: { gte: start, lte: end } } },
    _sum: { lineTotal: true, quantity: true },
    _count: true,
  });
  const services = await prisma.service.findMany({ where: { id: { in: groups.map((g) => g.serviceId).filter((v): v is string => !!v) } }, select: { id: true, title: true } });
  const names = new Map(services.map((s) => [s.id, s.title]));
  const total = groups.reduce((s, g) => s + n(g._sum.lineTotal), 0);
  const rows = groups
    .map((g) => ({ service: g.serviceId ? (names.get(g.serviceId) ?? "Deleted service") : "Custom items", lines: g._count, quantity: n(g._sum.quantity), revenue: n(g._sum.lineTotal) }))
    .sort((a, b) => b.revenue - a.revenue)
    .map((r) => ({ ...r, share: pct(r.revenue, total) }));
  return {
    columns: [
      { key: "service", label: "Service" },
      { key: "lines", label: "Invoice lines", type: "number" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "revenue", label: "Revenue excl. VAT (QAR)", type: "money" },
      { key: "share", label: "Share", type: "percent" },
    ],
    rows,
    totals: { service: "Total", lines: rows.reduce((s, r) => s + r.lines, 0), quantity: null, revenue: round2(total), share: rows.length ? 100 : 0 },
  };
}

async function customerRevenue({ start, end }: Range): Promise<ReportResult> {
  const groups = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { ...LIVE_INVOICE, issueDate: { gte: start, lte: end } },
    _sum: { subtotal: true, totalAmount: true, amountPaid: true },
    _count: true,
  });
  const customers = await prisma.customer.findMany({ where: { id: { in: groups.map((g) => g.customerId) } }, select: { id: true, name: true, companyName: true } });
  const names = new Map(customers.map((c) => [c.id, c.companyName ?? c.name]));
  const rows = groups
    .map((g) => {
      const total = n(g._sum.totalAmount);
      const paid = n(g._sum.amountPaid);
      return { customer: names.get(g.customerId) ?? "—", invoices: g._count, sales: n(g._sum.subtotal), total, paid, outstanding: round2(total - paid) };
    })
    .sort((a, b) => b.total - a.total);
  const sum = (k: "invoices" | "sales" | "total" | "paid" | "outstanding") => round2(rows.reduce((s, r) => s + r[k], 0));
  return {
    columns: [
      { key: "customer", label: "Customer" },
      { key: "invoices", label: "Invoices", type: "number" },
      { key: "sales", label: "Sales excl. VAT (QAR)", type: "money" },
      { key: "total", label: "Invoiced incl. VAT (QAR)", type: "money" },
      { key: "paid", label: "Paid (QAR)", type: "money" },
      { key: "outstanding", label: "Outstanding (QAR)", type: "money" },
    ],
    rows,
    totals: { customer: `Total (${rows.length} customers)`, invoices: sum("invoices"), sales: sum("sales"), total: sum("total"), paid: sum("paid"), outstanding: sum("outstanding") },
  };
}

async function paymentCollection({ start, end }: Range): Promise<ReportResult> {
  const groups = await prisma.payment.groupBy({ by: ["method"], where: { invoice: { deletedAt: null }, date: { gte: start, lte: end } }, _sum: { amount: true }, _count: true });
  const total = groups.reduce((s, g) => s + n(g._sum.amount), 0);
  const rows = groups
    .map((g) => ({ method: PAYMENT_METHOD_LABEL[g.method], payments: g._count, amount: n(g._sum.amount), share: pct(n(g._sum.amount), total) }))
    .sort((a, b) => b.amount - a.amount);
  return {
    columns: [
      { key: "method", label: "Method" },
      { key: "payments", label: "Payments", type: "number" },
      { key: "amount", label: "Collected (QAR)", type: "money" },
      { key: "share", label: "Share", type: "percent" },
    ],
    rows,
    totals: { method: "Total", payments: rows.reduce((s, r) => s + r.payments, 0), amount: round2(total), share: rows.length ? 100 : 0 },
  };
}

// ───────────── Operations ─────────────

async function employeeProductivity({ start, end }: Range): Promise<ReportResult> {
  const org = await currentOrgId(); // raw SQL isn't center-scoped by lib/prisma
  const [users, delivered, tasks] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.$queryRaw<{ uid: string; delivered: number; revenue: Prisma.Decimal; pages: number; words: number; timed: number; on_time: number }[]>(Prisma.sql`
      SELECT w."assignedToId" AS uid, count(*)::int AS delivered, sum(w."totalAmount") AS revenue,
             coalesce(sum(t."pageCount"), 0)::int AS pages, coalesce(sum(t."wordCount"), 0)::int AS words,
             (count(*) FILTER (WHERE w.deadline IS NOT NULL))::int AS timed,
             (count(*) FILTER (WHERE w.deadline IS NOT NULL AND w."deliveredAt" <= w.deadline))::int AS on_time
      FROM "WorkOrder" w LEFT JOIN "TranslationDetail" t ON t."workOrderId" = w.id
      WHERE w."organizationId" = ${org} AND w."deletedAt" IS NULL AND w."assignedToId" IS NOT NULL AND w."deliveredAt" BETWEEN ${start} AND ${end}
      GROUP BY 1`),
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: "DONE", completedAt: { gte: start, lte: end } }, _count: true }),
  ]);
  const d = new Map(delivered.map((r) => [r.uid, r]));
  const t = new Map(tasks.map((r) => [r.assignedToId, r._count]));
  const rows = users
    .map((u) => {
      const r = d.get(u.id);
      return {
        employee: u.name,
        delivered: r?.delivered ?? 0,
        pages: r?.pages ?? 0,
        words: r?.words ?? 0,
        onTime: r?.timed ? pct(r.on_time, r.timed) : null,
        tasks: t.get(u.id) ?? 0,
        revenue: n(r?.revenue),
      };
    })
    .sort((a, b) => b.delivered - a.delivered || b.tasks - a.tasks);
  const timed = delivered.reduce((s, r) => s + r.timed, 0);
  return {
    columns: [
      { key: "employee", label: "Employee" },
      { key: "delivered", label: "Orders delivered", type: "number" },
      { key: "pages", label: "Pages translated", type: "number" },
      { key: "words", label: "Words translated", type: "number" },
      { key: "onTime", label: "On time", type: "percent" },
      { key: "tasks", label: "Tasks done", type: "number" },
      { key: "revenue", label: "Order value excl. VAT (QAR)", type: "money" },
    ],
    rows,
    totals: {
      employee: "Total",
      delivered: rows.reduce((s, r) => s + r.delivered, 0),
      pages: rows.reduce((s, r) => s + r.pages, 0),
      words: rows.reduce((s, r) => s + r.words, 0),
      onTime: timed ? pct(delivered.reduce((s, r) => s + r.on_time, 0), timed) : null,
      tasks: rows.reduce((s, r) => s + r.tasks, 0),
      revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    },
    note: "Orders by delivery date and assignee; on time = delivered by the deadline (orders without a deadline are excluded).",
  };
}

async function outsourcedJobs({ start, end }: Range) {
  return prisma.outsourcedWork.findMany({
    where: { sentAt: { gte: start, lte: end }, workOrder: { deletedAt: null } },
    orderBy: { sentAt: "asc" },
    include: { vendor: { select: { name: true } }, workOrder: { select: { orderNo: true, totalAmount: true } } },
  });
}

async function freelancerPerformance(range: Range): Promise<ReportResult> {
  const jobs = await outsourcedJobs(range);
  const byVendor = new Map<string, typeof jobs>();
  for (const j of jobs) byVendor.set(j.vendor.name, [...(byVendor.get(j.vendor.name) ?? []), j]);
  const rows = [...byVendor.entries()]
    .map(([vendor, list]) => {
      const reviewed = list.filter((j) => j.qaStatus !== "PENDING");
      const timed = list.filter((j) => j.receivedAt && j.dueAt);
      return {
        vendor,
        jobs: list.length,
        cost: round2(list.reduce((s, j) => s + n(j.agreementCost), 0)),
        paid: round2(list.filter((j) => j.paymentStatus === "PAID").reduce((s, j) => s + n(j.agreementCost), 0)),
        approval: reviewed.length ? pct(reviewed.filter((j) => j.qaStatus === "APPROVED").length, reviewed.length) : null,
        onTime: timed.length ? pct(timed.filter((j) => j.receivedAt! <= j.dueAt!).length, timed.length) : null,
      };
    })
    .sort((a, b) => b.jobs - a.jobs);
  return {
    columns: [
      { key: "vendor", label: "Vendor" },
      { key: "jobs", label: "Jobs", type: "number" },
      { key: "cost", label: "Agreed cost (QAR)", type: "money" },
      { key: "paid", label: "Paid (QAR)", type: "money" },
      { key: "approval", label: "QA approved", type: "percent" },
      { key: "onTime", label: "On time", type: "percent" },
    ],
    rows,
    totals: { vendor: "Total", jobs: jobs.length, cost: round2(rows.reduce((s, r) => s + r.cost, 0)), paid: round2(rows.reduce((s, r) => s + r.paid, 0)), approval: null, onTime: null },
    note: "Jobs by date sent. QA approval rate counts reviewed jobs only.",
  };
}

async function outsourcedSummary(range: Range): Promise<ReportResult> {
  const jobs = await outsourcedJobs(range);
  const rows = jobs.map((j) => ({
    sent: formatLocal(j.sentAt, "yyyy-MM-dd"),
    order: j.workOrder.orderNo,
    vendor: j.vendor.name,
    description: j.description,
    orderValue: n(j.workOrder.totalAmount),
    cost: n(j.agreementCost),
    margin: round2(n(j.workOrder.totalAmount) - n(j.agreementCost)),
    qa: j.qaStatus.charAt(0) + j.qaStatus.slice(1).toLowerCase(),
    payment: j.paymentStatus === "PAID" ? "Paid" : "Unpaid",
    received: j.receivedAt ? formatLocal(j.receivedAt, "yyyy-MM-dd") : null,
  }));
  return {
    columns: [
      { key: "sent", label: "Sent", type: "date" },
      { key: "order", label: "Work order" },
      { key: "vendor", label: "Vendor" },
      { key: "description", label: "Description" },
      { key: "orderValue", label: "Order value (QAR)", type: "money" },
      { key: "cost", label: "Cost (QAR)", type: "money" },
      { key: "margin", label: "Margin (QAR)", type: "money" },
      { key: "qa", label: "QA" },
      { key: "payment", label: "Payment" },
      { key: "received", label: "Received", type: "date" },
    ],
    rows,
    totals: {
      sent: "Total",
      order: `${rows.length} jobs`,
      vendor: null,
      description: null,
      orderValue: round2(rows.reduce((s, r) => s + r.orderValue, 0)),
      cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
      margin: round2(rows.reduce((s, r) => s + r.margin, 0)),
      qa: null,
      payment: null,
      received: null,
    },
  };
}

/** Current pipeline snapshot plus orders received / delivered in the period. */
async function pendingVsCompleted({ start, end }: Range): Promise<ReportResult> {
  const now = new Date();
  const [open, overdue, revisions, received, delivered] = await Promise.all([
    prisma.workOrder.groupBy({ by: ["status"], where: { deletedAt: null, status: { not: "DELIVERED" } }, _count: true, _sum: { totalAmount: true } }),
    prisma.workOrder.groupBy({ by: ["status"], where: { deletedAt: null, status: { not: "DELIVERED" }, deadline: { lt: now } }, _count: true }),
    prisma.workOrder.aggregate({ where: { deletedAt: null, hasOpenRevision: true }, _count: true, _sum: { totalAmount: true } }),
    prisma.workOrder.aggregate({ where: { deletedAt: null, createdAt: { gte: start, lte: end } }, _count: true, _sum: { totalAmount: true } }),
    prisma.workOrder.aggregate({ where: { deletedAt: null, deliveredAt: { gte: start, lte: end } }, _count: true, _sum: { totalAmount: true } }),
  ]);
  const od = new Map(overdue.map((o) => [o.status, o._count]));
  const pending = WORK_ORDER_FLOW.filter((s) => s !== "DELIVERED").map((s) => {
    const g = open.find((o) => o.status === s);
    return { line: `Pending — ${WORK_ORDER_STATUS_LABEL[s]}`, jobs: g?._count ?? 0, value: n(g?._sum.totalAmount), overdue: od.get(s) ?? 0 };
  });
  const rows: ReportRow[] = [
    ...pending,
    { line: "Pending — total (now)", jobs: pending.reduce((s, r) => s + r.jobs, 0), value: round2(pending.reduce((s, r) => s + r.value, 0)), overdue: pending.reduce((s, r) => s + r.overdue, 0) },
    { line: "Open revisions (now)", jobs: revisions._count, value: n(revisions._sum.totalAmount), overdue: null },
    { line: "Received in period", jobs: received._count, value: n(received._sum.totalAmount), overdue: null },
    { line: "Completed (delivered) in period", jobs: delivered._count, value: n(delivered._sum.totalAmount), overdue: null },
  ];
  return {
    columns: [
      { key: "line", label: "Jobs" },
      { key: "jobs", label: "Count", type: "number" },
      { key: "value", label: "Value excl. VAT (QAR)", type: "money" },
      { key: "overdue", label: "Overdue", type: "number" },
    ],
    rows,
    note: "Pending rows are a live snapshot; received and completed rows use the selected period.",
  };
}

// ───────────── Finance ─────────────

async function expensesReport({ start, end }: Range): Promise<ReportResult> {
  const list = await prisma.expense.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" }, include: { vendor: { select: { name: true } } } });
  const rows = list.map((e) => ({
    date: formatLocal(e.date, "yyyy-MM-dd"),
    category: EXPENSE_CATEGORY_LABEL[e.category],
    description: e.description,
    vendor: e.vendor?.name ?? null,
    amount: n(e.amount),
    vat: n(e.vatAmount),
    total: round2(n(e.amount) + n(e.vatAmount)),
  }));
  return {
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "vendor", label: "Vendor" },
      { key: "amount", label: "Amount excl. VAT (QAR)", type: "money" },
      { key: "vat", label: "VAT (QAR)", type: "money" },
      { key: "total", label: "Total (QAR)", type: "money" },
    ],
    rows,
    totals: {
      date: "Total",
      category: `${rows.length} expenses`,
      description: null,
      vendor: null,
      amount: round2(rows.reduce((s, r) => s + r.amount, 0)),
      vat: round2(rows.reduce((s, r) => s + r.vat, 0)),
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
    },
  };
}

async function profitLossReport({ start, end }: Range): Promise<ReportResult> {
  const p = await profitAndLoss({ range: "custom", from: formatLocal(start, "yyyy-MM-dd"), to: formatLocal(end, "yyyy-MM-dd"), basis: "cash" });
  return {
    columns: [
      { key: "line", label: "Line" },
      { key: "amount", label: "QAR (excl. VAT)", type: "money" },
    ],
    rows: [
      { line: "Income (collected)", amount: n(p.income) },
      ...p.byCategory.map((c) => ({ line: `  ${EXPENSE_CATEGORY_LABEL[c.category]}`, amount: -n(c.amount) })),
      { line: "Total expenses", amount: -n(p.expenses) },
    ],
    totals: { line: p.net.isNegative() ? "Net loss" : "Net profit", amount: n(p.net) },
    note: `Cash basis: payments received with their VAT share removed. Margin ${p.marginPct ?? "—"}%.`,
  };
}

/** Output VAT on invoices issued, input VAT on expenses, net payable to the tax authority. */
async function vatReport({ start, end }: Range): Promise<ReportResult> {
  const [out, inp] = await Promise.all([
    prisma.invoice.aggregate({ where: { ...LIVE_INVOICE, issueDate: { gte: start, lte: end } }, _sum: { subtotal: true, vatAmount: true }, _count: true }),
    prisma.expense.aggregate({ where: { date: { gte: start, lte: end }, vatAmount: { gt: 0 } }, _sum: { amount: true, vatAmount: true }, _count: true }),
  ]);
  const outputVat = n(out._sum.vatAmount);
  const inputVat = n(inp._sum.vatAmount);
  return {
    columns: [
      { key: "line", label: "Box" },
      { key: "count", label: "Documents", type: "number" },
      { key: "amount", label: "Amount excl. VAT (QAR)", type: "money" },
      { key: "vat", label: "VAT (QAR)", type: "money" },
    ],
    rows: [
      { line: "Standard-rated supplies (output VAT)", count: out._count, amount: n(out._sum.subtotal), vat: outputVat },
      { line: "Expenses with recoverable VAT (input VAT)", count: inp._count, amount: n(inp._sum.amount), vat: inputVat },
    ],
    totals: { line: round2(outputVat - inputVat) >= 0 ? "Net VAT payable" : "Net VAT refundable", count: null, amount: null, vat: round2(outputVat - inputVat) },
    note: "Invoices by issue date (accrual), cancelled excluded. Check against your VAT return before filing.",
  };
}

// ───────────── Registry ─────────────

export const REPORTS: ReportDef[] = [
  { slug: "daily-sales", title: "Daily sales", description: "Invoiced and collected per day.", group: "Sales", defaultRange: "month", run: (r) => salesByPeriod(r, "YYYY-MM-DD") },
  { slug: "monthly-sales", title: "Monthly sales", description: "Invoiced and collected per month.", group: "Sales", defaultRange: "12m", run: (r) => salesByPeriod(r, "YYYY-MM") },
  { slug: "service-revenue", title: "Service-wise revenue", description: "Revenue and quantity per service.", group: "Sales", defaultRange: "month", run: serviceRevenue },
  { slug: "customer-revenue", title: "Customer-wise revenue", description: "Invoiced, paid and outstanding per customer.", group: "Sales", defaultRange: "month", run: customerRevenue },
  { slug: "payment-collection", title: "Payment collection summary", description: "Collections by payment method.", group: "Sales", defaultRange: "month", run: paymentCollection },
  { slug: "employee-productivity", title: "Employee productivity", description: "Orders delivered, pages/words, on-time rate, tasks.", group: "Operations", defaultRange: "month", run: employeeProductivity },
  { slug: "freelancer-performance", title: "Freelancer performance", description: "Jobs, cost, QA approval and on-time rate per vendor.", group: "Operations", defaultRange: "ytd", run: freelancerPerformance },
  { slug: "outsourced-summary", title: "Outsourced work summary", description: "Every outsourced job with cost and margin.", group: "Operations", defaultRange: "month", run: outsourcedSummary },
  { slug: "pending-completed", title: "Pending vs completed jobs", description: "Open pipeline by stage, overdue, received and delivered.", group: "Operations", defaultRange: "month", run: pendingVsCompleted },
  { slug: "expenses", title: "Expenses", description: "Every expense with category, VAT and vendor.", group: "Finance", defaultRange: "month", run: expensesReport },
  { slug: "profit-loss", title: "Profit & loss", description: "Income less expenses by category, net of VAT.", group: "Finance", defaultRange: "month", run: profitLossReport },
  { slug: "vat", title: "VAT report", description: "Output VAT, input VAT and net payable for a period.", group: "Finance", defaultRange: "month", run: vatReport },
];

export const getReport = (slug: string) => REPORTS.find((r) => r.slug === slug) ?? null;

export async function runReport(def: ReportDef, params: ReportParams) {
  const range = reportRange(def, params);
  return { range, period: `${formatLocal(range.start, "d MMM yyyy")} – ${formatLocal(range.end, "d MMM yyyy")}`, result: await def.run(range) };
}
