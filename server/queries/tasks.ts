import "server-only";
import type { Prisma, Priority, TaskStatus } from "@prisma/client";
import { can } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { daysFromTodayDubai, endOfTodayDubai, startOfTodayDubai } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const TASK_PAGE_SIZE = 25;
const DONE_ON_BOARD_DAYS = 14;

export type TaskListParams = { q?: string; assignee?: string; priority?: string; due?: string; status?: string; view?: string; page?: string; task?: string };

/** STAFF default to their own tasks; "everyone" shows the whole team. Returns "all", "none" or a user id. */
export function effectiveAssignee(p: TaskListParams, user: Pick<CurrentUser, "id" | "role">) {
  if (p.assignee === "everyone") return "all";
  if (p.assignee) return p.assignee;
  return can(user.role, "tasks:viewAll") ? "all" : user.id;
}

function filterWhere(p: TaskListParams, user: Pick<CurrentUser, "id" | "role">, withStatus: boolean): Prisma.TaskWhereInput {
  const assignee = effectiveAssignee(p, user);
  const q = p.q?.trim();
  const open = { status: { not: "DONE" as const } };
  const due: Prisma.TaskWhereInput =
    p.due === "overdue"
      ? { ...open, deadline: { lt: startOfTodayDubai() } }
      : p.due === "today"
        ? { deadline: { gte: startOfTodayDubai(), lte: endOfTodayDubai() } }
        : p.due === "week"
          ? { ...open, deadline: { lte: daysFromTodayDubai(7) } }
          : p.due === "none"
            ? { deadline: null }
            : {};
  return {
    ...(assignee === "all" ? {} : assignee === "none" ? { assignedToId: null } : { assignedToId: assignee }),
    ...(["NORMAL", "HIGH", "URGENT"].includes(p.priority ?? "") ? { priority: p.priority as Priority } : {}),
    ...(withStatus && ["TODO", "IN_PROGRESS", "DONE"].includes(p.status ?? "") ? { status: p.status as TaskStatus } : {}),
    ...due,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { workOrder: { orderNo: { contains: q, mode: "insensitive" } } },
            { workOrder: { customer: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  deadline: true,
  completedAt: true,
  assignedTo: { select: { id: true, name: true } },
  workOrder: { select: { id: true, orderNo: true, customer: { select: { name: true } } } },
} satisfies Prisma.TaskSelect;

export async function boardTasks(p: TaskListParams, user: Pick<CurrentUser, "id" | "role">) {
  const recent = new Date(Date.now() - DONE_ON_BOARD_DAYS * 86_400_000);
  return prisma.task.findMany({
    where: { AND: [filterWhere(p, user, false), { OR: [{ status: { not: "DONE" } }, { completedAt: { gte: recent } }] }] },
    orderBy: [{ priority: "desc" }, { deadline: { sort: "asc", nulls: "last" } }],
    take: 400,
    select: taskSelect,
  });
}

export type TaskCard = Awaited<ReturnType<typeof boardTasks>>[number];

export async function listTasks(p: TaskListParams, user: Pick<CurrentUser, "id" | "role">) {
  const page = Math.max(1, Number(p.page) || 1);
  const where = filterWhere(p, user, true);
  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { deadline: { sort: "asc", nulls: "last" } }],
      skip: (page - 1) * TASK_PAGE_SIZE,
      take: TASK_PAGE_SIZE,
      select: taskSelect,
    }),
    prisma.task.count({ where }),
  ]);
  return { rows, total, page };
}

/** Task with its work order context: client notes and revision history. */
export async function getTaskDetail(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      workOrder: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          hasOpenRevision: true,
          notes: true,
          deadline: true,
          customer: { select: { id: true, name: true, phone: true, notes: true } },
          service: { select: { title: true } },
          revisions: {
            orderBy: { requestedAt: "desc" },
            select: { id: true, reason: true, requestedAt: true, resolvedAt: true, resolution: true, requestedBy: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
