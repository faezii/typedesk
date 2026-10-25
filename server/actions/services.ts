"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serviceSchema, type ServiceFormValues } from "@/lib/validation/work-order";

export async function saveService(id: string | null, input: ServiceFormValues): Promise<ActionResult<{ id: string }>> {
  const g = await guardAction("services:edit", id);
  if (!g.user) return { ok: false, error: g.error };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const data = parsed.data;
  if (id && !(await prisma.service.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "Service not found." };

  const service = id ? await prisma.service.update({ where: { id }, data }) : await prisma.service.create({ data });
  await prisma.activityLog.create({
    data: { entityType: "Service", entityId: service.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Created"} service ${service.title} (QAR ${service.defaultPrice.toFixed(2)})`, userId: g.user.id },
  });
  revalidatePath("/services");
  return { ok: true, data: { id: service.id } };
}

/** Inactive services stay on existing orders but can't be picked for new work. */
export async function setServiceActive(id: string, isActive: boolean): Promise<ActionResult> {
  const g = await guardAction("services:edit", id);
  if (!g.user) return { ok: false, error: g.error };
  const { count } = await prisma.service.updateMany({ where: { id }, data: { isActive: Boolean(isActive) } });
  if (count === 0) return { ok: false, error: "Service not found." };
  await prisma.activityLog.create({
    data: { entityType: "Service", entityId: id, action: isActive ? "activated" : "deactivated", message: `Service ${isActive ? "activated" : "deactivated"}`, userId: g.user.id },
  });
  revalidatePath("/services");
  return { ok: true, data: undefined };
}
