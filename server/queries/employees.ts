import "server-only";
import { startOfMonthDubai } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Staff directory with live workload counters. */
export async function listEmployees() {
  const monthStart = startOfMonthDubai();
  const [users, openTasks, activeOrders, delivered, tasksDone] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, role: true, department: true, isActive: true, mustChangePassword: true, lastLoginAt: true },
    }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: { not: "DONE" }, assignedToId: { not: null } }, _count: true }),
    prisma.workOrder.groupBy({
      by: ["assignedToId"],
      where: { deletedAt: null, assignedToId: { not: null }, OR: [{ status: { not: "DELIVERED" } }, { hasOpenRevision: true }] },
      _count: true,
    }),
    prisma.workOrder.groupBy({ by: ["assignedToId"], where: { deletedAt: null, assignedToId: { not: null }, deliveredAt: { gte: monthStart } }, _count: true }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: "DONE", completedAt: { gte: monthStart }, assignedToId: { not: null } }, _count: true }),
  ]);
  const count = (rows: { assignedToId: string | null; _count: number }[]) => new Map(rows.map((r) => [r.assignedToId, r._count]));
  const [ot, ao, dl, td] = [count(openTasks), count(activeOrders), count(delivered), count(tasksDone)];
  return users.map((u) => ({
    ...u,
    openTasks: ot.get(u.id) ?? 0,
    activeOrders: ao.get(u.id) ?? 0,
    deliveredThisMonth: dl.get(u.id) ?? 0,
    tasksDoneThisMonth: td.get(u.id) ?? 0,
  }));
}

export async function activeUserOptions() {
  return prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
