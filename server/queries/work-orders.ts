import "server-only";
import { cache } from "react";
import { Prisma, type Priority, type WorkOrderStatus } from "@prisma/client";
import { endOfTodayDubai, parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { WORK_ORDER_FLOW } from "@/lib/work-orders";
import { listDocuments } from "./documents";

export const WO_PAGE_SIZE = 25;
/** Delivered cards stay on the board this long (or while a revision is open). */
const BOARD_DELIVERED_DAYS = 14;

export type WorkOrderListParams = {
  q?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  customerId?: string;
  from?: string;
  to?: string;
  page?: string;
  view?: string;
};

function filterWhere(p: WorkOrderListParams, withStatus: boolean): Prisma.WorkOrderWhereInput {
  const q = p.q?.trim();
  const from = parseDateInput(p.from);
  const to = parseDateInput(p.to);
  return {
    deletedAt: null,
    ...(withStatus && WORK_ORDER_FLOW.includes(p.status as WorkOrderStatus) ? { status: p.status as WorkOrderStatus } : {}),
    ...(withStatus && p.status === "REVISION" ? { hasOpenRevision: true } : {}),
    ...(["NORMAL", "HIGH", "URGENT"].includes(p.priority ?? "") ? { priority: p.priority as Priority } : {}),
    ...(p.assignee === "none" ? { assignedToId: null } : p.assignee ? { assignedToId: p.assignee } : {}),
    ...(p.customerId ? { customerId: p.customerId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: endOfTodayDubai(to) } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { orderNo: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { companyName: { contains: q, mode: "insensitive" } } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

const cardSelect = {
  id: true,
  orderNo: true,
  status: true,
  priority: true,
  hasOpenRevision: true,
  deadline: true,
  totalAmount: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  service: { select: { title: true } },
  assignedTo: { select: { name: true } },
  translation: { select: { sourceLang: true, targetLang: true, pageCount: true } },
} satisfies Prisma.WorkOrderSelect;

export async function listWorkOrders(p: WorkOrderListParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const where = filterWhere(p, true);
  const [rows, total] = await Promise.all([
    prisma.workOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * WO_PAGE_SIZE, take: WO_PAGE_SIZE, select: cardSelect }),
    prisma.workOrder.count({ where }),
  ]);
  return { rows, total, page };
}

/** Open work plus recent deliveries, as plain JSON for the client board. */
export async function boardWorkOrders(p: WorkOrderListParams) {
  const recent = new Date(Date.now() - BOARD_DELIVERED_DAYS * 86_400_000);
  const rows = await prisma.workOrder.findMany({
    where: {
      AND: [
        filterWhere(p, false),
        { OR: [{ status: { not: "DELIVERED" } }, { hasOpenRevision: true }, { deliveredAt: { gte: recent } }] },
      ],
    },
    // Postgres enum order is NORMAL < HIGH < URGENT, so desc puts urgent first.
    orderBy: [{ priority: "desc" }, { deadline: { sort: "asc", nulls: "last" } }],
    take: 400,
    select: cardSelect,
  });
  return rows.map((r) => ({ ...r, totalAmount: r.totalAmount.toFixed(2) }));
}

export type BoardCard = Awaited<ReturnType<typeof boardWorkOrders>>[number];

export const getWorkOrder = cache(async (id: string) => {
  const wo = await prisma.workOrder.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, phone: true, companyName: true } },
      service: true,
      assignedTo: { select: { id: true, name: true } },
      translation: true,
      revisions: {
        orderBy: { requestedAt: "desc" },
        include: { requestedBy: { select: { name: true } }, resolvedBy: { select: { name: true } } },
      },
      tasks: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, priority: true, deadline: true, assignedTo: { select: { name: true } } } },
      outsourced: { orderBy: { sentAt: "desc" }, include: { vendor: { select: { name: true } } } },
      invoiceItems: {
        where: { invoice: { deletedAt: null } },
        select: { invoice: { select: { id: true, invoiceNo: true, status: true, totalAmount: true, amountPaid: true, issueDate: true } } },
      },
    },
  });
  if (!wo) return null;

  const [activity, documents] = await Promise.all([
    prisma.activityLog.findMany({
      where: { entityType: "WorkOrder", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, message: true, createdAt: true, user: { select: { name: true } } },
    }),
    listDocuments({ workOrderId: id }),
  ]);
  // One invoice can hold several lines for the same order.
  const invoices = [...new Map(wo.invoiceItems.map((i) => [i.invoice.id, i.invoice])).values()];
  return { ...wo, activity, documents, invoices };
});

/** Choices for the work order form. Decimal → string so they can cross to the client. */
export async function workOrderFormOptions() {
  const [services, users] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { title: "asc" }] }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, department: true } }),
  ]);
  return {
    services: services.map((s) => ({ id: s.id, title: s.title, category: s.category, unit: s.unit, defaultPrice: s.defaultPrice.toFixed(2) })),
    users,
  };
}

export type WorkOrderFormOptions = Awaited<ReturnType<typeof workOrderFormOptions>>;
