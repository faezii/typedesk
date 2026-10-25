"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { formatDubai, parseDateInput } from "@/lib/dates";
import { snoozedDeadline } from "@/lib/follow-ups";
import { prisma } from "@/lib/prisma";
import { followUpSchema, type FollowUpFormValues } from "@/lib/validation/team";

function refresh() {
  revalidatePath("/follow-ups");
  revalidatePath("/customers", "layout");
  revalidatePath("/");
}

export async function saveFollowUp(id: string | null, input: FollowUpFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("followUps:edit", id);
  if (!user) return { ok: false, error };
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = parsed.data;
  if (id && !(await prisma.followUp.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "This follow-up no longer exists." };
  if (d.customerId && !(await prisma.customer.findFirst({ where: { id: d.customerId, deletedAt: null }, select: { id: true } }))) {
    return { ok: false, error: "That customer no longer exists.", fieldErrors: { customerId: "Not found" } };
  }
  if (d.assignedToId && !(await prisma.user.findFirst({ where: { id: d.assignedToId, isActive: true }, select: { id: true } }))) {
    return { ok: false, error: "That staff member is not active.", fieldErrors: { assignedToId: "Not active" } };
  }

  const data = { title: d.title, type: d.type, deadline: parseDateInput(d.deadline)!, customerId: d.customerId, assignedToId: d.assignedToId, notes: d.notes };
  const f = id ? await prisma.followUp.update({ where: { id }, data }) : await prisma.followUp.create({ data });
  await prisma.activityLog.create({
    data: { entityType: "FollowUp", entityId: f.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Created"} follow-up "${f.title}"`, userId: user.id },
  });
  refresh();
  return { ok: true, data: { id: f.id } };
}

/** One-click Done / reopen. */
export async function setFollowUpDone(id: string, done: boolean): Promise<ActionResult> {
  const { user, error } = await guardAction("followUps:edit", id);
  if (!user) return { ok: false, error };
  const { count } = await prisma.followUp.updateMany({ where: { id }, data: { status: done ? "DONE" : "PENDING" } });
  if (count === 0) return { ok: false, error: "This follow-up no longer exists." };
  await prisma.activityLog.create({
    data: { entityType: "FollowUp", entityId: id, action: done ? "done" : "reopened", message: done ? "Marked done" : "Reopened", userId: user.id },
  });
  refresh();
  return { ok: true, data: undefined };
}

/** Push 7 days past the later of today and the current deadline. */
export async function snoozeFollowUp(id: string): Promise<ActionResult<{ until: string }>> {
  const { user, error } = await guardAction("followUps:edit", id);
  if (!user) return { ok: false, error };
  const f = await prisma.followUp.findUnique({ where: { id }, select: { deadline: true } });
  if (!f) return { ok: false, error: "This follow-up no longer exists." };
  const deadline = snoozedDeadline(f.deadline);
  await prisma.$transaction([
    prisma.followUp.update({ where: { id }, data: { deadline, status: "SNOOZED" } }),
    prisma.activityLog.create({
      data: { entityType: "FollowUp", entityId: id, action: "snoozed", message: `Snoozed until ${formatDubai(deadline, "d MMM yyyy")}`, userId: user.id },
    }),
  ]);
  refresh();
  return { ok: true, data: { until: formatDubai(deadline, "d MMM") } };
}
