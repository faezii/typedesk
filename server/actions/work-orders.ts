"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WorkOrderStatus } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, guardAction, requirePermission } from "@/lib/auth/session";
import { parseDateTimeInput } from "@/lib/dates";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { lineTotal } from "@/lib/money";
import { nextNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { workOrderSchema, type WorkOrderFormValues } from "@/lib/validation/work-order";
import { isTranslation } from "@/lib/work-orders";

type Guarded = { user: Awaited<ReturnType<typeof requirePermission>> } | { error: string };

async function guard(): Promise<Guarded> {
  try {
    return { user: await requirePermission("workOrders:edit") };
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: e.message };
    throw e;
  }
}

function refresh(id?: string) {
  revalidatePath("/work-orders", "layout");
  revalidatePath("/translation");
  revalidatePath("/");
  if (id) revalidatePath(`/work-orders/${id}`);
}

const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });

/** Create (id = null) or update a work order. Totals are computed here, never trusted from the client. */
export async function saveWorkOrder(id: string | null, input: WorkOrderFormValues): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if ("error" in g) return fail(g.error);

  const parsed = workOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
  }
  const d = parsed.data;

  const existing = id ? await prisma.workOrder.findFirst({ where: { id, deletedAt: null }, select: { serviceId: true, assignedToId: true } }) : null;
  if (id && !existing) return fail("This work order no longer exists.");

  const [service, customer, assignee] = await Promise.all([
    prisma.service.findUnique({ where: { id: d.serviceId } }),
    prisma.customer.findFirst({ where: { id: d.customerId, deletedAt: null }, select: { id: true } }),
    d.assignedToId ? prisma.user.findFirst({ where: { id: d.assignedToId, isActive: true }, select: { name: true } }) : null,
  ]);
  // Inactive services can't be chosen for new work, but an existing order may keep its retired service.
  if (!service || (!service.isActive && existing?.serviceId !== service.id)) return fail("Choose an active service.", { serviceId: "Not available" });
  if (!customer) return fail("That customer no longer exists.", { customerId: "Not found" });
  if (d.assignedToId && !assignee) return fail("That staff member is not active.", { assignedToId: "Not active" });

  const t = d.translation;
  const translation = isTranslation(service.category) ? t : null;
  if (translation) {
    const errs: Record<string, string> = {};
    if (!t.sourceLang) errs["translation.sourceLang"] = "Choose the source language";
    if (!t.targetLang) errs["translation.targetLang"] = "Choose the target language";
    if (t.sourceLang && t.sourceLang === t.targetLang) errs["translation.targetLang"] = "Must differ from the source language";
    if (service.unit === "PAGE" && t.pageCount < 1) errs["translation.pageCount"] = "Enter the page count";
    if (service.unit === "WORD" && t.wordCount < 1) errs["translation.wordCount"] = "Enter the word count";
    if (Object.keys(errs).length) return fail("Please fix the translation details.", errs);
  }

  const data = {
    customerId: d.customerId,
    serviceId: service.id,
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    totalAmount: lineTotal(d.quantity, d.unitPrice),
    priority: d.priority,
    deadline: parseDateTimeInput(d.deadline),
    assignedToId: d.assignedToId,
    notes: d.notes,
  };
  const user = g.user;

  const saved = await prisma.$transaction(async (tx) => {
    const wo = id
      ? await tx.workOrder.update({ where: { id }, data })
      : await tx.workOrder.create({ data: { ...data, orderNo: await nextNumber(tx, "WO") } });

    if (translation) {
      const tData = {
        sourceLang: translation.sourceLang,
        targetLang: translation.targetLang,
        pageCount: translation.pageCount,
        wordCount: translation.wordCount,
        isCertified: translation.isCertified,
      };
      await tx.translationDetail.upsert({ where: { workOrderId: wo.id }, create: { ...tData, workOrderId: wo.id }, update: tData });
    } else if (id) {
      await tx.translationDetail.deleteMany({ where: { workOrderId: wo.id } });
    }

    const log = (action: string, message: string) =>
      tx.activityLog.create({ data: { entityType: "WorkOrder", entityId: wo.id, action, message, userId: user.id } });
    if (!id) await log("created", `Work order ${wo.orderNo} received`);
    else await log("updated", "Order details updated");
    if (data.assignedToId && data.assignedToId !== existing?.assignedToId) await log("assigned", `Assigned to ${assignee!.name}`);
    return wo;
  });

  refresh(saved.id);
  return { ok: true, data: { id: saved.id } };
}

/** Lookup for work order pickers (tasks, outsourcing). */
export async function findWorkOrders(q: string) {
  const { user } = await guardAction("workOrders:view");
  const term = q.trim();
  if (!user || term.length < 2) return [];
  return prisma.workOrder.findMany({
    where: {
      deletedAt: null,
      OR: [{ orderNo: { contains: term, mode: "insensitive" } }, { customer: { name: { contains: term, mode: "insensitive" } } }],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, orderNo: true, customer: { select: { name: true } }, service: { select: { title: true } } },
  });
}

const statusSchema = z.enum(["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"]);

/**
 * Move an order to another stage (Kanban drag or status menu).
 * `from` is the status the user saw; if someone else moved it meanwhile, nothing changes.
 */
export async function moveWorkOrder(id: string, from: WorkOrderStatus, to: WorkOrderStatus): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return fail(g.error);
  const parsed = z.object({ id: z.string().min(1), from: statusSchema, to: statusSchema }).safeParse({ id, from, to });
  if (!parsed.success) return fail("Invalid status.");
  if (from === to) return { ok: true, data: undefined };

  const wo = await prisma.workOrder.findFirst({ where: { id, deletedAt: null }, select: { hasOpenRevision: true } });
  if (!wo) return fail("This work order no longer exists.");
  if (wo.hasOpenRevision) return fail("This order has an open revision. Resolve the revision first — it stays Delivered while being corrected.");

  const moved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.workOrder.updateMany({
      where: { id, status: from, deletedAt: null },
      data: { status: to, deliveredAt: to === "DELIVERED" ? new Date() : null },
    });
    if (count === 0) return false;
    await tx.activityLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: id,
        action: "status_changed",
        message: `Status changed from ${WORK_ORDER_STATUS_LABEL[from]} to ${WORK_ORDER_STATUS_LABEL[to]}`,
        userId: g.user.id,
      },
    });
    return true;
  });
  if (!moved) {
    refresh(id);
    return fail("Someone else updated this order just now. The board has been refreshed.");
  }
  refresh(id);
  return { ok: true, data: undefined };
}

const noteSchema = z.string().trim().min(3, "Describe the correction (at least 3 characters)").max(500);

/** Flag a delivered order for correction. Status stays DELIVERED; history is kept. */
export async function requestRevision(id: string, reason: string): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return fail(g.error);
  const r = noteSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]!.message);

  const ok = await prisma.$transaction(async (tx) => {
    const { count } = await tx.workOrder.updateMany({
      where: { id, deletedAt: null, status: "DELIVERED", hasOpenRevision: false },
      data: { hasOpenRevision: true },
    });
    if (count === 0) return false;
    await tx.workOrderRevision.create({ data: { workOrderId: id, reason: r.data, requestedById: g.user.id } });
    await tx.activityLog.create({
      data: { entityType: "WorkOrder", entityId: id, action: "revision_requested", message: `Revision requested: ${r.data}`, userId: g.user.id },
    });
    return true;
  });
  if (!ok) return fail("Only delivered orders without an open revision can be sent for revision.");
  refresh(id);
  return { ok: true, data: undefined };
}

export async function resolveRevision(id: string, resolution: string): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return fail(g.error);
  const r = noteSchema.safeParse(resolution);
  if (!r.success) return fail(r.error.issues[0]!.message);

  const ok = await prisma.$transaction(async (tx) => {
    const { count } = await tx.workOrder.updateMany({ where: { id, deletedAt: null, hasOpenRevision: true }, data: { hasOpenRevision: false } });
    if (count === 0) return false;
    await tx.workOrderRevision.updateMany({
      where: { workOrderId: id, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById: g.user.id, resolution: r.data },
    });
    await tx.activityLog.create({
      data: { entityType: "WorkOrder", entityId: id, action: "revision_resolved", message: `Revision resolved: ${r.data}`, userId: g.user.id },
    });
    return true;
  });
  if (!ok) return fail("There is no open revision on this order.");
  refresh(id);
  return { ok: true, data: undefined };
}
