"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/validation/country";

export type SearchResults = {
  customers: { id: string; name: string; subtitle: string }[];
  workOrders: { id: string; orderNo: string; subtitle: string; status: string }[];
  invoices: { id: string; invoiceNo: string; subtitle: string; status: string; total: string }[];
};

const EMPTY: SearchResults = { customers: [], workOrders: [], invoices: [] };
const querySchema = z.string().trim().min(2).max(80);

/** Phones are stored as "+974 5512 3456"; map digit input like "55123456" or "+97455123456" onto that. */
const phoneQuery = (q: string) => (/^[\d\s+()-]+$/.test(q) ? normalizePhone(q) : null);

export async function globalSearch(rawQuery: string): Promise<SearchResults> {
  const user = await getCurrentUser();
  if (!user) return EMPTY;
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) return EMPTY;
  const q = parsed.data;
  const contains = { contains: q, mode: "insensitive" as const };
  const phone = phoneQuery(q);

  const [customers, workOrders, invoices] = await Promise.all([
    can(user.role, "customers:view")
      ? prisma.customer.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: contains },
              { companyName: contains },
              { email: contains },
              { phone: contains },
              { nationalId: contains },
              { passportNo: contains },
              ...(phone ? [{ phone: { contains: phone } }] : []),
            ],
          },
          select: { id: true, name: true, companyName: true, phone: true },
          take: 6,
          orderBy: { updatedAt: "desc" },
        })
      : [],
    can(user.role, "workOrders:view")
      ? prisma.workOrder.findMany({
          where: {
            deletedAt: null,
            OR: [{ orderNo: contains }, { notes: contains }, { customer: { name: contains } }],
          },
          select: { id: true, orderNo: true, status: true, customer: { select: { name: true } }, service: { select: { title: true } } },
          take: 6,
          orderBy: { createdAt: "desc" },
        })
      : [],
    can(user.role, "finance:view")
      ? prisma.invoice.findMany({
          where: {
            deletedAt: null,
            OR: [{ invoiceNo: contains }, { customer: { name: contains } }, { customer: { companyName: contains } }],
          },
          select: { id: true, invoiceNo: true, status: true, totalAmount: true, customer: { select: { name: true } } },
          take: 6,
          orderBy: { issueDate: "desc" },
        })
      : [],
  ]);

  return {
    customers: customers.map((c) => ({ id: c.id, name: c.name, subtitle: [c.companyName, c.phone].filter(Boolean).join(" · ") })),
    workOrders: workOrders.map((w) => ({
      id: w.id,
      orderNo: w.orderNo,
      status: w.status,
      subtitle: `${w.customer.name} · ${w.service.title}`,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNo: i.invoiceNo,
      status: i.status,
      subtitle: i.customer.name,
      total: `QAR ${Number(i.totalAmount).toLocaleString("en-QA", { minimumFractionDigits: 2 })}`,
    })),
  };
}
