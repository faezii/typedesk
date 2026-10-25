import "server-only";
import { Prisma, type ExpenseCategory, type PaymentMethod } from "@prisma/client";
import { addMonths, startOfQuarter, startOfYear } from "date-fns";
import { TIMEZONE, zone, endOfTodayLocal, formatLocal, monthsAgoLocal, parseDateInput, startOfMonthLocal, startOfTodayLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const zero = new Prisma.Decimal(0);
const plain = (d: Date) => new Date(d.getTime());

// ───────────── Payments ─────────────

export const PAYMENT_PAGE_SIZE = 30;
export type PaymentParams = { method?: string; from?: string; to?: string; q?: string; page?: string; day?: string };

function rangeWhere(from?: string, to?: string) {
  const f = parseDateInput(from);
  const t = parseDateInput(to);
  return f || t ? { ...(f ? { gte: f } : {}), ...(t ? { lte: endOfTodayLocal(t) } : {}) } : undefined;
}

export async function listPayments(p: PaymentParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const q = p.q?.trim();
  const where: Prisma.PaymentWhereInput = {
    invoice: { deletedAt: null },
    ...(["CASH", "CARD", "BANK_TRANSFER", "ONLINE"].includes(p.method ?? "") ? { method: p.method as PaymentMethod } : {}),
    ...(rangeWhere(p.from, p.to) ? { date: rangeWhere(p.from, p.to) } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { invoice: { invoiceNo: { contains: q, mode: "insensitive" } } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total, byMethod] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAYMENT_PAGE_SIZE,
      take: PAYMENT_PAGE_SIZE,
      include: { invoice: { select: { id: true, invoiceNo: true } }, customer: { select: { id: true, name: true } }, receivedBy: { select: { name: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ["method"], where, _sum: { amount: true }, _count: true }),
  ]);
  return { rows, total, page, byMethod: Object.fromEntries(byMethod.map((m) => [m.method, { amount: m._sum.amount ?? zero, count: m._count }])) as Partial<Record<PaymentMethod, { amount: Prisma.Decimal; count: number }>> };
}

/** One day's collections (Doha day) broken down by method and by staff member. */
export async function dailyCollection(day?: string) {
  const start = parseDateInput(day) ?? startOfTodayLocal();
  const where: Prisma.PaymentWhereInput = { invoice: { deletedAt: null }, date: { gte: start, lte: endOfTodayLocal(start) } };
  const [byMethod, byStaff, total] = await Promise.all([
    prisma.payment.groupBy({ by: ["method"], where, _sum: { amount: true }, _count: true }),
    prisma.payment.groupBy({ by: ["receivedById", "method"], where, _sum: { amount: true } }),
    prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: byStaff.map((s) => s.receivedById).filter((v): v is string => !!v) } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  const staff = new Map<string, { name: string; total: Prisma.Decimal; methods: Partial<Record<PaymentMethod, Prisma.Decimal>> }>();
  for (const s of byStaff) {
    const key = s.receivedById ?? "none";
    const row = staff.get(key) ?? { name: s.receivedById ? (names.get(s.receivedById) ?? "Former staff") : "Not recorded", total: zero, methods: {} };
    row.total = row.total.plus(s._sum.amount ?? 0);
    row.methods[s.method] = s._sum.amount ?? zero;
    staff.set(key, row);
  }
  return {
    day: formatLocal(start, "yyyy-MM-dd"),
    label: formatLocal(start, "EEEE d MMMM yyyy"),
    total: total._sum.amount ?? zero,
    count: total._count,
    byMethod: Object.fromEntries(byMethod.map((m) => [m.method, { amount: m._sum.amount ?? zero, count: m._count }])) as Partial<Record<PaymentMethod, { amount: Prisma.Decimal; count: number }>>,
    byStaff: [...staff.values()].sort((a, b) => b.total.comparedTo(a.total)),
  };
}

// ───────────── Expenses ─────────────

export const EXPENSE_PAGE_SIZE = 30;
export type ExpenseParams = { category?: string; from?: string; to?: string; q?: string; page?: string };

export async function listExpenses(p: ExpenseParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const q = p.q?.trim();
  const where: Prisma.ExpenseWhereInput = {
    ...(["RENT", "UTILITY", "SUPPLIES", "SOFTWARE", "FREELANCER", "SALARY", "OTHER"].includes(p.category ?? "") ? { category: p.category as ExpenseCategory } : {}),
    ...(rangeWhere(p.from, p.to) ? { date: rangeWhere(p.from, p.to) } : {}),
    ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { vendor: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total, sums, byCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * EXPENSE_PAGE_SIZE,
      take: EXPENSE_PAGE_SIZE,
      include: { vendor: { select: { id: true, name: true } }, outsourcedWork: { select: { workOrder: { select: { id: true, orderNo: true } } } } },
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true, vatAmount: true } }),
    prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
  ]);
  return {
    rows,
    total,
    page,
    sums: { amount: sums._sum.amount ?? zero, vat: sums._sum.vatAmount ?? zero },
    byCategory: byCategory.map((c) => ({ category: c.category, amount: c._sum.amount ?? zero })).sort((a, b) => b.amount.comparedTo(a.amount)),
  };
}

/** Last 6 Doha months of expense totals (net of VAT) — chart data. */
export async function expenseTrend() {
  const from = monthsAgoLocal(5);
  const rows = await prisma.$queryRaw<{ m: string; total: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', ("date" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}), 'YYYY-MM') AS m, SUM(amount)::float8 AS total
    FROM "Expense" WHERE "date" >= ${from} GROUP BY 1`);
  const byMonth = new Map(rows.map((r) => [r.m, r.total]));
  return Array.from({ length: 6 }, (_, i) => {
    const d = monthsAgoLocal(5 - i);
    return { month: formatLocal(d, "yyyy-MM"), label: formatLocal(d, "MMM"), value: byMonth.get(formatLocal(d, "yyyy-MM")) ?? 0 };
  });
}

// ───────────── Profit & Loss ─────────────

export type PnlParams = { range?: string; from?: string; to?: string; basis?: string };
export type Basis = "cash" | "accrual";

export function resolveRange(p: PnlParams) {
  const now = new Date();
  const end = endOfTodayLocal();
  switch (p.range) {
    case "last-month": {
      const start = monthsAgoLocal(1);
      return { key: "last-month", start, end: plain(new Date(startOfMonthLocal().getTime() - 1)) };
    }
    case "quarter":
      return { key: "quarter", start: plain(startOfQuarter(now, { in: zone })), end };
    case "ytd":
      return { key: "ytd", start: plain(startOfYear(now, { in: zone })), end };
    case "custom": {
      const start = parseDateInput(p.from) ?? startOfMonthLocal();
      const to = parseDateInput(p.to);
      return { key: "custom", start, end: to ? endOfTodayLocal(to) : end };
    }
    default:
      return { key: "month", start: startOfMonthLocal(), end };
  }
}

/**
 * Income is net of VAT. Cash basis = payments received in the period, with each payment's VAT share
 * removed pro rata (amount × subtotal / total). Accrual basis = subtotals of invoices issued in the period.
 */
async function incomeBetween(start: Date, end: Date, basis: Basis) {
  if (basis === "accrual") {
    const r = await prisma.invoice.aggregate({
      where: { deletedAt: null, status: { not: "CANCELLED" }, issueDate: { gte: start, lte: end } },
      _sum: { subtotal: true, vatAmount: true },
    });
    return { income: r._sum.subtotal ?? zero, vat: r._sum.vatAmount ?? zero };
  }
  const [r] = await prisma.$queryRaw<{ net: Prisma.Decimal | null; gross: Prisma.Decimal | null }[]>(Prisma.sql`
    SELECT SUM(p.amount * i.subtotal / NULLIF(i."totalAmount", 0)) AS net, SUM(p.amount) AS gross
    FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
    WHERE i."deletedAt" IS NULL AND p."date" >= ${start} AND p."date" <= ${end}`);
  const net = new Prisma.Decimal(r?.net ?? 0).toDecimalPlaces(2);
  return { income: net, vat: new Prisma.Decimal(r?.gross ?? 0).minus(net) };
}

export async function profitAndLoss(p: PnlParams) {
  const basis: Basis = p.basis === "accrual" ? "accrual" : "cash";
  const range = resolveRange(p);
  const [{ income, vat }, byCategory] = await Promise.all([
    incomeBetween(range.start, range.end, basis),
    prisma.expense.groupBy({ by: ["category"], where: { date: { gte: range.start, lte: range.end } }, _sum: { amount: true, vatAmount: true } }),
  ]);
  const expenses = byCategory.reduce((s, c) => s.plus(c._sum.amount ?? 0), zero);
  const net = income.minus(expenses);
  return {
    basis,
    range,
    income,
    vatCollected: vat,
    expenses,
    inputVat: byCategory.reduce((s, c) => s.plus(c._sum.vatAmount ?? 0), zero),
    byCategory: byCategory.map((c) => ({ category: c.category, amount: c._sum.amount ?? zero })).sort((a, b) => b.amount.comparedTo(a.amount)),
    net,
    marginPct: income.isZero() ? null : net.div(income).times(100).toDecimalPlaces(1).toNumber(),
  };
}

/** 12 Doha months of income / expenses / net (numbers for charting only). */
export async function pnlTrend(basis: Basis) {
  const months = Array.from({ length: 12 }, (_, i) => monthsAgoLocal(11 - i));
  return Promise.all(
    months.map(async (start) => {
      const end = plain(new Date(addMonths(start, 1, { in: zone }).getTime() - 1));
      const [{ income }, exp] = await Promise.all([incomeBetween(start, end, basis), prisma.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } })]);
      const expenses = exp._sum.amount ?? zero;
      return { label: formatLocal(start, "MMM yy"), income: income.toNumber(), expenses: expenses.toNumber(), net: income.minus(expenses).toNumber() };
    }),
  );
}
