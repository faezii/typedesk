"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export type SearchResults = {
  customers: { id: string; name: string; subtitle: string }[];
  workOrders: { id: string; orderNo: string; subtitle: string; status: string }[];
  invoices: { id: string; invoiceNo: string; subtitle: string; status: string; total: string }[];
};

const EMPTY: SearchResults = { customers: [], workOrders: [], invoices: [] };
const querySchema = z.string().trim().min(2).max(80);

/** Phones are stored as "+971 50 123 4567"; map digit input like "0501234567" or "971501234567" onto that. */
function formatUaeMobile(q: string) {
  if (!/^[\d\s+()-]+$/.test(q)) return null;
  const digits = q.replace(/\D/g, "").replace(/^(00971|971|0)/, "");
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

export async function globalSearch(rawQuery: string): Promise<SearchResults> {
  const user = await getCurrentUser();
  if (!user) return EMPTY;
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) return EMPTY;
  const q = parsed.data;
  const contains = { contains: q, mode: "insensitive" as const };
  const phone = formatUaeMobile(q);

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
              { emiratesId: contains },
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
      total: `AED ${Number(i.totalAmount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`,
    })),
  };
}
