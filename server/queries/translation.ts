import "server-only";
import type { Prisma } from "@prisma/client";
import { daysFromTodayLocal, startOfMonthLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const ACTIVE: Prisma.WorkOrderWhereInput = { OR: [{ status: { not: "DELIVERED" } }, { hasOpenRevision: true }] };
const TRANSLATIONS: Prisma.WorkOrderWhereInput = { deletedAt: null, translation: { isNot: null } };

export async function getTranslationOverview() {
  const [total, activeAgg, monthAgg, dueThisWeek, stages, pairs, active] = await Promise.all([
    prisma.workOrder.count({ where: TRANSLATIONS }),
    prisma.translationDetail.aggregate({ where: { workOrder: { ...TRANSLATIONS, ...ACTIVE } }, _sum: { pageCount: true }, _count: true }),
    prisma.translationDetail.aggregate({ where: { workOrder: { ...TRANSLATIONS, createdAt: { gte: startOfMonthLocal() } } }, _sum: { wordCount: true } }),
    prisma.workOrder.count({ where: { ...TRANSLATIONS, status: { not: "DELIVERED" }, deadline: { lte: daysFromTodayLocal(7) } } }),
    prisma.workOrder.groupBy({ by: ["status"], where: { ...TRANSLATIONS, status: { not: "DELIVERED" } }, _count: true }),
    prisma.translationDetail.groupBy({
      by: ["sourceLang", "targetLang"],
      where: { workOrder: { deletedAt: null } },
      _count: true,
      _sum: { pageCount: true },
      orderBy: { _count: { workOrderId: "desc" } },
      take: 8,
    }),
    prisma.workOrder.findMany({
      where: { ...TRANSLATIONS, ...ACTIVE },
      orderBy: { deadline: { sort: "asc", nulls: "last" } },
      take: 100,
      select: {
        id: true,
        orderNo: true,
        status: true,
        priority: true,
        hasOpenRevision: true,
        deadline: true,
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        translation: { select: { sourceLang: true, targetLang: true, pageCount: true, wordCount: true, isCertified: true } },
      },
    }),
  ]);

  return {
    counters: {
      total,
      activeOrders: activeAgg._count,
      activePages: activeAgg._sum.pageCount ?? 0,
      wordsThisMonth: monthAgg._sum.wordCount ?? 0,
      dueThisWeek,
    },
    stages: Object.fromEntries(stages.map((s) => [s.status, s._count])) as Partial<Record<string, number>>,
    pairs: pairs.map((p) => ({ pair: `${p.sourceLang} → ${p.targetLang}`, from: p.sourceLang, to: p.targetLang, orders: p._count, pages: p._sum.pageCount ?? 0 })),
    active,
  };
}
