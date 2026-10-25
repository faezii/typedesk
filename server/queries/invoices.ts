import "server-only";
import { cache } from "react";
import type { InvoiceStatus, Prisma, QuotationStatus } from "@prisma/client";
import { endOfTodayLocal, parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const INVOICE_PAGE_SIZE = 25;

export type InvoiceListParams = { tab?: string; q?: string; status?: string; from?: string; to?: string; page?: string };

function dateRange(p: InvoiceListParams) {
  const from = parseDateInput(p.from);
  const to = parseDateInput(p.to);
  return from || to ? { issueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: endOfTodayLocal(to) } : {}) } } : {};
}

const customerMatch = (q: string) => [
  { customer: { name: { contains: q, mode: "insensitive" as const } } },
  { customer: { companyName: { contains: q, mode: "insensitive" as const } } },
];

export async function listInvoices(p: InvoiceListParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const q = p.q?.trim();
  const where: Prisma.InvoiceWhereInput = {
    deletedAt: null,
    ...(["UNPAID", "PARTIAL", "PAID", "CANCELLED"].includes(p.status ?? "") ? { status: p.status as InvoiceStatus } : {}),
    ...(p.status === "OUTSTANDING" ? { status: { in: ["UNPAID", "PARTIAL"] } } : {}),
    ...dateRange(p),
    ...(q ? { OR: [{ invoiceNo: { contains: q, mode: "insensitive" } }, ...customerMatch(q)] } : {}),
  };
  const [rows, total, sums] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      select: { id: true, invoiceNo: true, status: true, issueDate: true, dueDate: true, totalAmount: true, amountPaid: true, customer: { select: { id: true, name: true } } },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: { ...where, status: { not: "CANCELLED" } }, _sum: { totalAmount: true, amountPaid: true } }),
  ]);
  return { rows, total, page, sums: sums._sum };
}

export async function listQuotations(p: InvoiceListParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const q = p.q?.trim();
  const where: Prisma.QuotationWhereInput = {
    ...(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED"].includes(p.status ?? "") ? { status: p.status as QuotationStatus } : {}),
    ...dateRange(p),
    ...(q ? { OR: [{ quoteNo: { contains: q, mode: "insensitive" } }, ...customerMatch(q)] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      select: { id: true, quoteNo: true, status: true, issueDate: true, validUntil: true, totalAmount: true, customer: { select: { id: true, name: true } } },
    }),
    prisma.quotation.count({ where }),
  ]);
  return { rows, total, page };
}

const customerSelect = { id: true, name: true, companyName: true, phone: true, email: true, taxNo: true } satisfies Prisma.CustomerSelect;

export const getInvoice = cache(async (id: string) =>
  prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: customerSelect },
      quotation: { select: { id: true, quoteNo: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { workOrder: { select: { id: true, orderNo: true } } } },
      payments: { orderBy: { date: "asc" }, include: { receivedBy: { select: { name: true } } } },
    },
  }),
);

export const getQuotation = cache(async (id: string) =>
  prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: customerSelect },
      items: { orderBy: { sortOrder: "asc" } },
      invoices: { where: { deletedAt: null }, select: { id: true, invoiceNo: true } },
    },
  }),
);

/** Delivered orders with no live invoice line — candidates to bill. */
export async function uninvoicedWorkOrders(customerId: string, includeIds: string[] = []) {
  return prisma.workOrder.findMany({
    where: {
      customerId,
      deletedAt: null,
      OR: [
        { status: "DELIVERED", invoiceItems: { none: { invoice: { deletedAt: null, status: { not: "CANCELLED" } } } } },
        { id: { in: includeIds } },
      ],
    },
    orderBy: { deliveredAt: "desc" },
    take: 50,
    select: { id: true, orderNo: true, quantity: true, unitPrice: true, totalAmount: true, notes: true, deliveredAt: true, serviceId: true, service: { select: { title: true } } },
  });
}

/** Services for the line-item picker (Decimal → string for the client). */
export async function serviceOptions() {
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { title: "asc" }], select: { id: true, title: true, defaultPrice: true } });
  return services.map((s) => ({ ...s, defaultPrice: s.defaultPrice.toFixed(2) }));
}
