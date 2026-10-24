import "server-only";
import { Prisma, type WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import {
  TIMEZONE,
  daysFromTodayDubai,
  endOfTodayDubai,
  formatDubai,
  monthsAgoDubai,
  startOfMonthDubai,
  startOfTodayDubai,
} from "@/lib/dates";

type Viewer = Pick<CurrentUser, "id" | "role">;

/** STAFF see work assigned to them; everyone else sees the whole centre. */
const ownWork = (u: Viewer): Prisma.WorkOrderWhereInput => (can(u.role, "dashboard:viewAll") ? {} : { assignedToId: u.id });

const OPEN: Prisma.WorkOrderWhereInput = { status: { not: "DELIVERED" } };
const IN_PROGRESS_STATUSES: WorkOrderStatus[] = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"];
/** Delivered work with no live (non-cancelled, non-deleted) invoice line pointing at it. */
const NOT_INVOICED: Prisma.WorkOrderWhereInput = {
  status: "DELIVERED",
  invoiceItems: { none: { invoice: { deletedAt: null, status: { not: "CANCELLED" } } } },
};

export async function getKpis(user: Viewer) {
  const scope = { deletedAt: null, ...ownWork(user) };
  const startToday = startOfTodayDubai();
  const endToday = endOfTodayDubai();
  const finance = can(user.role, "finance:view");

  // Month-to-date vs the same span of last month, so the comparison is fair on day 5 as on day 25.
  const now = new Date();
  const monthStart = startOfMonthDubai();
  const lastMonthStart = monthsAgoDubai(1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));

  const [customers, active, dueToday, overdue, pending, revenueNow, revenuePrev] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.workOrder.count({ where: { ...scope, OR: [OPEN, { hasOpenRevision: true }] } }),
    prisma.workOrder.count({ where: { ...scope, ...OPEN, deadline: { gte: startToday, lte: endToday } } }),
    prisma.workOrder.count({ where: { ...scope, ...OPEN, deadline: { lt: startToday } } }),
    finance ? prisma.workOrder.aggregate({ where: { deletedAt: null, ...NOT_INVOICED }, _count: true, _sum: { totalAmount: true } }) : null,
    finance ? sumPayments(monthStart, now) : null,
    finance ? sumPayments(lastMonthStart, lastMonthSameDay) : null,
  ]);

  return {
    customers,
    active,
    dueToday,
    overdue,
    pendingInvoicing: pending ? { count: pending._count, amount: pending._sum.totalAmount ?? new Prisma.Decimal(0) } : null,
    revenue:
      revenueNow && revenuePrev
        ? {
            amount: revenueNow,
            // null when there is nothing to compare against
            changePct: revenuePrev.isZero() ? null : revenueNow.minus(revenuePrev).div(revenuePrev).times(100).toNumber(),
          }
        : null,
  };
}

async function sumPayments(from: Date, to: Date) {
  const r = await prisma.payment.aggregate({
    where: { date: { gte: from, lte: to }, invoice: { deletedAt: null } },
    _sum: { amount: true },
  });
  return r._sum.amount ?? new Prisma.Decimal(0);
}

export type RevenuePoint = { month: string; label: string; invoiced: number; collected: number };

/** Last 6 months (incl. current), grouped by Dubai calendar month. Numbers are for charting only. */
export async function getRevenueSeries(): Promise<RevenuePoint[]> {
  const from = monthsAgoDubai(5);
  // Timestamps are stored as UTC without zone; convert before truncating to the Dubai month.
  const [collected, invoiced] = await Promise.all([
    prisma.$queryRaw<{ m: string; total: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', (p."date" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}), 'YYYY-MM') AS m,
             SUM(p.amount)::float8 AS total
      FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
      WHERE i."deletedAt" IS NULL AND p."date" >= ${from}
      GROUP BY 1`),
    prisma.$queryRaw<{ m: string; total: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', ("issueDate" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}), 'YYYY-MM') AS m,
             SUM("totalAmount")::float8 AS total
      FROM "Invoice"
      WHERE "deletedAt" IS NULL AND status <> 'CANCELLED' AND "issueDate" >= ${from}
      GROUP BY 1`),
  ]);
  const byMonth = (rows: { m: string; total: number }[]) => new Map(rows.map((r) => [r.m, r.total]));
  const c = byMonth(collected);
  const inv = byMonth(invoiced);

  return Array.from({ length: 6 }, (_, i) => {
    const d = monthsAgoDubai(5 - i);
    const month = formatDubai(d, "yyyy-MM");
    return { month, label: formatDubai(d, "MMM"), invoiced: inv.get(month) ?? 0, collected: c.get(month) ?? 0 };
  });
}

export type StatusSlice = { key: "inProgress" | "ready" | "delivered" | "revisions"; label: string; value: number };

/** Current pipeline plus the last 30 days of deliveries (all-time deliveries would drown everything else). */
export async function getStatusBreakdown(user: Viewer): Promise<StatusSlice[]> {
  const scope = { deletedAt: null, ...ownWork(user) };
  const since = new Date(startOfTodayDubai().getTime() - 30 * 86_400_000);
  const [inProgress, ready, delivered, revisions] = await Promise.all([
    prisma.workOrder.count({ where: { ...scope, status: { in: IN_PROGRESS_STATUSES } } }),
    prisma.workOrder.count({ where: { ...scope, status: "READY" } }),
    prisma.workOrder.count({ where: { ...scope, status: "DELIVERED", hasOpenRevision: false, deliveredAt: { gte: since } } }),
    prisma.workOrder.count({ where: { ...scope, hasOpenRevision: true } }),
  ]);
  return [
    { key: "inProgress", label: "In Progress", value: inProgress },
    { key: "ready", label: "Ready", value: ready },
    { key: "delivered", label: "Delivered", value: delivered },
    { key: "revisions", label: "Revisions", value: revisions },
  ];
}

export async function getDueWorkOrders(user: Viewer) {
  const where: Prisma.WorkOrderWhereInput = { deletedAt: null, ...ownWork(user), ...OPEN, deadline: { lte: endOfTodayDubai() } };
  const [items, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      orderBy: [{ deadline: "asc" }, { priority: "desc" }],
      take: 7,
      select: {
        id: true,
        orderNo: true,
        status: true,
        priority: true,
        deadline: true,
        customer: { select: { name: true } },
        service: { select: { title: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.workOrder.count({ where }),
  ]);
  return { items, total, startToday: startOfTodayDubai() };
}

/** Pending follow-ups due today through the next 7 days, plus how many are already overdue. */
export async function getUpcomingFollowUps(user: Viewer) {
  const base: Prisma.FollowUpWhereInput = {
    status: "PENDING",
    ...(can(user.role, "dashboard:viewAll") ? {} : { assignedToId: user.id }),
  };
  const startToday = startOfTodayDubai();
  const [items, overdue] = await Promise.all([
    prisma.followUp.findMany({
      where: { ...base, deadline: { gte: startToday, lte: daysFromTodayDubai(7) } },
      orderBy: { deadline: "asc" },
      take: 6,
      select: { id: true, title: true, type: true, deadline: true, customer: { select: { name: true } } },
    }),
    prisma.followUp.count({ where: { ...base, deadline: { lt: startToday } } }),
  ]);
  return { items, overdue };
}

export async function getRecentPayments() {
  return prisma.payment.findMany({
    where: { invoice: { deletedAt: null } },
    orderBy: { date: "desc" },
    take: 6,
    select: {
      id: true,
      amount: true,
      method: true,
      date: true,
      customer: { select: { name: true } },
      invoice: { select: { id: true, invoiceNo: true } },
    },
  });
}
