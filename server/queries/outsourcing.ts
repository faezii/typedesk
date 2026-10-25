import "server-only";
import { Prisma, type QaStatus, type SettlementStatus } from "@prisma/client";
import { startOfMonthDubai } from "@/lib/dates";
import { jobMargin } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const JOB_PAGE_SIZE = 25;

export type AssignmentParams = { q?: string; vendor?: string; qa?: string; payment?: string; page?: string; tab?: string };

export async function listAssignments(p: AssignmentParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const q = p.q?.trim();
  const where: Prisma.OutsourcedWorkWhereInput = {
    workOrder: { deletedAt: null },
    ...(p.vendor ? { vendorId: p.vendor } : {}),
    ...(["PENDING", "APPROVED", "REJECTED"].includes(p.qa ?? "") ? { qaStatus: p.qa as QaStatus } : {}),
    ...(["UNPAID", "PAID"].includes(p.payment ?? "") ? { paymentStatus: p.payment as SettlementStatus } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q, mode: "insensitive" } },
            { vendor: { name: { contains: q, mode: "insensitive" } } },
            { workOrder: { orderNo: { contains: q, mode: "insensitive" } } },
            { workOrder: { customer: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.outsourcedWork.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * JOB_PAGE_SIZE,
      take: JOB_PAGE_SIZE,
      include: {
        vendor: { select: { id: true, name: true, type: true } },
        workOrder: { select: { id: true, orderNo: true, totalAmount: true, customer: { select: { name: true } } } },
        documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, name: true, fileUrl: true } },
      },
    }),
    prisma.outsourcedWork.count({ where }),
  ]);
  return { rows: rows.map((r) => ({ ...r, ...jobMargin(r.workOrder.totalAmount, r.agreementCost) })), total, page };
}

export async function outsourcingSummary() {
  const [awaitingDelivery, awaitingQa, unpaid, paidThisMonth] = await Promise.all([
    prisma.outsourcedWork.count({ where: { receivedAt: null, workOrder: { deletedAt: null } } }),
    prisma.outsourcedWork.count({ where: { receivedAt: { not: null }, qaStatus: "PENDING", workOrder: { deletedAt: null } } }),
    prisma.outsourcedWork.aggregate({ where: { paymentStatus: "UNPAID", workOrder: { deletedAt: null } }, _sum: { agreementCost: true }, _count: true }),
    prisma.expense.aggregate({ where: { outsourcedWorkId: { not: null }, date: { gte: startOfMonthDubai() } }, _sum: { amount: true } }),
  ]);
  return {
    awaitingDelivery,
    awaitingQa,
    unpaidCount: unpaid._count,
    unpaidAmount: unpaid._sum.agreementCost ?? new Prisma.Decimal(0),
    paidThisMonth: paidThisMonth._sum.amount ?? new Prisma.Decimal(0),
  };
}

/** Vendors with job counts, money owed and a simple quality/timeliness record. */
export async function listVendors() {
  const vendors = await prisma.vendor.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { outsourcedWork: { select: { agreementCost: true, paymentStatus: true, qaStatus: true, dueAt: true, receivedAt: true } } },
  });
  return vendors.map(({ outsourcedWork: jobs, ...v }) => {
    const reviewed = jobs.filter((j) => j.qaStatus !== "PENDING");
    const timed = jobs.filter((j) => j.receivedAt && j.dueAt);
    const sum = (list: typeof jobs) => list.reduce((s, j) => s.plus(j.agreementCost), new Prisma.Decimal(0));
    return {
      ...v,
      jobs: jobs.length,
      paid: sum(jobs.filter((j) => j.paymentStatus === "PAID")),
      unpaid: sum(jobs.filter((j) => j.paymentStatus === "UNPAID")),
      approvalRate: reviewed.length ? Math.round((reviewed.filter((j) => j.qaStatus === "APPROVED").length / reviewed.length) * 100) : null,
      onTimeRate: timed.length ? Math.round((timed.filter((j) => j.receivedAt! <= j.dueAt!).length / timed.length) * 100) : null,
    };
  });
}

export async function vendorOptions() {
  return prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, languages: true } });
}
