import "server-only";
import { cache } from "react";
import { Prisma, type CustomerType } from "@prisma/client";
import { daysFromTodayDubai, startOfTodayDubai } from "@/lib/dates";
import { EXPIRY_WARNING_DAYS } from "@/lib/expiry";
import { prisma } from "@/lib/prisma";
import { normalizeUaePhone } from "@/lib/validation/uae";
import { listDocuments } from "./documents";

export const PAGE_SIZE = 25;

export type CustomerListParams = { q?: string; type?: string; expiry?: string; page?: string };

/** Unpaid/partly-paid live invoices are what a customer owes. */
const OPEN_INVOICE: Prisma.InvoiceWhereInput = { deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } };

export function customerSearchWhere(q: string | undefined): Prisma.CustomerWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const contains = { contains: term, mode: "insensitive" as const };
  const phone = normalizeUaePhone(term);
  return {
    OR: [
      { name: contains },
      { companyName: contains },
      { email: contains },
      { phone: contains },
      { emiratesId: contains },
      { passportNo: contains },
      ...(phone ? [{ phone: { contains: phone } }] : []),
    ],
  };
}

function expiryWhere(expiry: string | undefined): Prisma.CustomerWhereInput {
  const today = startOfTodayDubai();
  if (expiry === "expired") return { OR: [{ passportExpiry: { lt: today } }, { emiratesIdExpiry: { lt: today } }] };
  if (expiry === "expiring") {
    const window = { gte: today, lte: daysFromTodayDubai(EXPIRY_WARNING_DAYS) };
    return { OR: [{ passportExpiry: window }, { emiratesIdExpiry: window }] };
  }
  return {};
}

export async function listCustomers(params: CustomerListParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(params.type === "INDIVIDUAL" || params.type === "COMPANY" ? { type: params.type as CustomerType } : {}),
    AND: [customerSearchWhere(params.q), expiryWhere(params.expiry)],
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        type: true,
        companyName: true,
        phone: true,
        email: true,
        emiratesId: true,
        emiratesIdExpiry: true,
        passportNo: true,
        passportExpiry: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const balances = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { ...OPEN_INVOICE, customerId: { in: rows.map((r) => r.id) } },
    _sum: { totalAmount: true, amountPaid: true },
  });
  const owed = new Map(
    balances.map((b) => [b.customerId, (b._sum.totalAmount ?? new Prisma.Decimal(0)).minus(b._sum.amountPaid ?? 0)]),
  );

  return {
    rows: rows.map((r) => ({ ...r, outstanding: owed.get(r.id) ?? new Prisma.Decimal(0) })),
    total,
    page,
  };
}

/** Cached per request: generateMetadata and the page share one load. */
export const getCustomer = cache(async (id: string) => {
  const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!customer) return null;

  const [workOrders, invoices, payments, documents, followUps] = await Promise.all([
    prisma.workOrder.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        orderNo: true,
        status: true,
        hasOpenRevision: true,
        priority: true,
        totalAmount: true,
        deadline: true,
        createdAt: true,
        service: { select: { title: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { issueDate: "desc" },
      select: { id: true, invoiceNo: true, status: true, issueDate: true, dueDate: true, totalAmount: true, amountPaid: true },
    }),
    prisma.payment.findMany({
      where: { customerId: id, invoice: { deletedAt: null } },
      orderBy: { date: "asc" },
      select: { id: true, amount: true, method: true, reference: true, date: true, invoice: { select: { invoiceNo: true } } },
    }),
    listDocuments({ customerId: id }),
    prisma.followUp.findMany({
      where: { customerId: id },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      select: { id: true, title: true, type: true, status: true, deadline: true, notes: true },
    }),
  ]);

  // Ledger: invoices debit, payments credit, oldest first with a running balance.
  const entries = [
    ...invoices
      .filter((i) => i.status !== "CANCELLED")
      .map((i) => ({ id: i.id, date: i.issueDate, kind: "invoice" as const, ref: i.invoiceNo, debit: i.totalAmount, credit: null })),
    ...payments.map((p) => ({ id: p.id, date: p.date, kind: "payment" as const, ref: p.invoice.invoiceNo, method: p.method, reference: p.reference, debit: null, credit: p.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === "invoice" ? -1 : 1));

  let balance = new Prisma.Decimal(0);
  const ledger = entries.map((e) => {
    balance = balance.plus(e.debit ?? 0).minus(e.credit ?? 0);
    return { ...e, balance };
  });

  const billed = invoices.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s.plus(i.totalAmount), new Prisma.Decimal(0));
  const paid = payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));

  return { customer, workOrders, invoices, ledger, documents, followUps, totals: { billed, paid, outstanding: balance } };
});

/** For pickers: small, fast name/phone/ID search. */
export async function searchCustomers(q: string) {
  return prisma.customer.findMany({
    where: { deletedAt: null, ...customerSearchWhere(q) },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, companyName: true, phone: true },
  });
}
