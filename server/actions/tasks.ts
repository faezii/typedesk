"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TaskStatus } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { guardAction, type CurrentUser } from "@/lib/auth/session";
import { parseDateTimeInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { taskSchema, type TaskFormValues } from "@/lib/validation/team";

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" };

/** STAFF may only change tasks assigned to them (or unassigned ones they pick up). */
function ownsOrMayEdit(user: CurrentUser, assignedToId: string | null) {
  return user.role !== "STAFF" || !assignedToId || assignedToId === user.id;
}

function refresh(workOrderId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/employees");
  if (workOrderId) revalidatePath(`/work-orders/${workOrderId}`);
}

export async function saveTask(id: string | null, input: TaskFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("tasks:edit");
  if (!user) return { ok: false, error };

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = parsed.data;

  const existing = id ? await prisma.task.findUnique({ where: { id }, select: { assignedToId: true } }) : null;
  if (id && !existing) return { ok: false, error: "This task no longer exists." };
  if (existing && !ownsOrMayEdit(user, existing.assignedToId)) return { ok: false, error: "You can only edit tasks assigned to you." };

  const [assignee, workOrder] = await Promise.all([
    d.assignedToId ? prisma.user.findFirst({ where: { id: d.assignedToId, isActive: true }, select: { name: true } }) : null,
    d.workOrderId ? prisma.workOrder.findFirst({ where: { id: d.workOrderId, deletedAt: null }, select: { id: true, orderNo: true } }) : null,
  ]);
  if (d.assignedToId && !assignee) return { ok: false, error: "That staff member is not active.", fieldErrors: { assignedToId: "Not active" } };
  if (d.workOrderId && !workOrder) return { ok: false, error: "That work order no longer exists.", fieldErrors: { workOrderId: "Not found" } };

  const data = { title: d.title, description: d.description, priority: d.priority, deadline: parseDateTimeInput(d.deadline), assignedToId: d.assignedToId, workOrderId: d.workOrderId };
  const task = await prisma.$transaction(async (tx) => {
    const t = id ? await tx.task.update({ where: { id }, data }) : await tx.task.create({ data });
    await tx.activityLog.create({
      data: { entityType: "Task", entityId: t.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Created"} task "${t.title}"`, userId: user.id },
    });
    if (!id && workOrder) {
      await tx.activityLog.create({
        data: { entityType: "WorkOrder", entityId: workOrder.id, action: "task_added", message: `Task added: ${t.title}${assignee ? ` (${assignee.name})` : ""}`, userId: user.id },
      });
    }
    return t;
  });

  refresh(task.workOrderId);
  return { ok: true, data: { id: task.id } };
}

export async function moveTask(id: string, to: TaskStatus): Promise<ActionResult> {
  const { user, error } = await guardAction("tasks:edit");
  if (!user) return { ok: false, error };
  if (!z.enum(["TODO", "IN_PROGRESS", "DONE"]).safeParse(to).success) return { ok: false, error: "Invalid status." };

  const task = await prisma.task.findUnique({ where: { id }, select: { status: true, title: true, assignedToId: true, workOrderId: true } });
  if (!task) return { ok: false, error: "This task no longer exists." };
  if (!ownsOrMayEdit(user, task.assignedToId)) return { ok: false, error: "You can only move tasks assigned to you." };
  if (task.status === to) return { ok: true, data: undefined };

  await prisma.$transaction([
    prisma.task.update({
      where: { id },
      // Picking up an unassigned task assigns it to whoever starts it.
      data: { status: to, completedAt: to === "DONE" ? new Date() : null, ...(!task.assignedToId && to !== "TODO" ? { assignedToId: user.id } : {}) },
    }),
    prisma.activityLog.create({
      data: { entityType: "Task", entityId: id, action: "status_changed", message: `"${task.title}": ${STATUS_LABEL[task.status]} → ${STATUS_LABEL[to]}`, userId: user.id },
    }),
  ]);
  refresh(task.workOrderId);
  return { ok: true, data: undefined };
}
