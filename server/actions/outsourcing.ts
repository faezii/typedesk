"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QaStatus } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { formatLocal, parseDateInput } from "@/lib/dates";
import { LANGUAGES } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { UploadError, saveUpload } from "@/lib/storage";
import { assignmentSchema, vendorSchema, type AssignmentFormValues, type VendorFormValues } from "@/lib/validation/outsourcing";

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

function refresh(workOrderId?: string) {
  revalidatePath("/outsourced");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/profit-loss");
  if (workOrderId) revalidatePath(`/work-orders/${workOrderId}`);
}

const woLog = (workOrderId: string, userId: string, action: string, message: string) =>
  prisma.activityLog.create({ data: { entityType: "WorkOrder", entityId: workOrderId, action, message, userId } });

// ───────────── Vendors ─────────────

export async function saveVendor(id: string | null, input: VendorFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("outsourced:edit", id);
  if (!user) return { ok: false, error };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const data = { ...parsed.data, languages: parsed.data.languages.filter((l) => (LANGUAGES as readonly string[]).includes(l)) };
  if (id && !(await prisma.vendor.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "Vendor not found." };

  const vendor = id ? await prisma.vendor.update({ where: { id }, data }) : await prisma.vendor.create({ data });
  await prisma.activityLog.create({
    data: { entityType: "Vendor", entityId: vendor.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Added"} vendor ${vendor.name}`, userId: user.id },
  });
  refresh();
  return { ok: true, data: { id: vendor.id } };
}

export async function setVendorActive(id: string, active: boolean): Promise<ActionResult> {
  const { user, error } = await guardAction("outsourced:edit", id);
  if (!user) return { ok: false, error };
  const { count } = await prisma.vendor.updateMany({ where: { id }, data: { isActive: Boolean(active) } });
  if (count === 0) return { ok: false, error: "Vendor not found." };
  refresh();
  return { ok: true, data: undefined };
}

// ───────────── Assignments ─────────────

export async function saveAssignment(id: string | null, input: AssignmentFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("outsourced:edit", id);
  if (!user) return { ok: false, error };
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const existing = id ? await prisma.outsourcedWork.findUnique({ where: { id }, select: { vendorId: true, paymentStatus: true, agreementCost: true } }) : null;
  if (id && !existing) return { ok: false, error: "This job no longer exists." };
  // The FREELANCER expense mirrors the cost; changing a paid job's cost would leave them out of step.
  if (existing?.paymentStatus === "PAID" && !existing.agreementCost.eq(d.agreementCost)) {
    return { ok: false, error: "This job is already paid. Mark it unpaid before changing the cost.", fieldErrors: { agreementCost: "Already paid" } };
  }

  const [wo, vendor] = await Promise.all([
    prisma.workOrder.findFirst({ where: { id: d.workOrderId, deletedAt: null }, select: { id: true, orderNo: true } }),
    prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { name: true, isActive: true } }),
  ]);
  if (!wo) return { ok: false, error: "That work order no longer exists.", fieldErrors: { workOrderId: "Not found" } };
  if (!vendor || (!vendor.isActive && existing?.vendorId !== d.vendorId)) return { ok: false, error: "Choose an active vendor.", fieldErrors: { vendorId: "Not active" } };

  const data = {
    workOrderId: wo.id,
    vendorId: d.vendorId,
    description: d.description,
    agreementCost: d.agreementCost,
    sentAt: parseDateInput(d.sentAt)!,
    dueAt: parseDateInput(d.dueAt),
  };
  const job = id ? await prisma.outsourcedWork.update({ where: { id }, data }) : await prisma.outsourcedWork.create({ data });
  await woLog(wo.id, user.id, id ? "outsourcing_updated" : "outsourced", `${id ? "Outsourcing updated" : "Outsourced"} to ${vendor.name} — QAR ${job.agreementCost.toFixed(2)}`);
  refresh(wo.id);
  return { ok: true, data: { id: job.id } };
}

/** QA approve / reject (or back to pending). A QA decision implies the vendor delivered. */
export async function setQaStatus(id: string, status: QaStatus): Promise<ActionResult> {
  const { user, error } = await guardAction("outsourced:edit", id);
  if (!user) return { ok: false, error };
  if (!z.enum(["PENDING", "APPROVED", "REJECTED"]).safeParse(status).success) return { ok: false, error: "Invalid QA status." };
  const job = await prisma.outsourcedWork.findUnique({ where: { id }, select: { workOrderId: true, receivedAt: true, vendor: { select: { name: true } } } });
  if (!job) return { ok: false, error: "This job no longer exists." };

  await prisma.outsourcedWork.update({ where: { id }, data: { qaStatus: status, ...(status !== "PENDING" && !job.receivedAt ? { receivedAt: new Date() } : {}) } });
  await woLog(job.workOrderId, user.id, "outsourcing_qa", `QA ${status.toLowerCase()} for ${job.vendor.name}'s delivery`);
  refresh(job.workOrderId);
  return { ok: true, data: undefined };
}

/**
 * Paying a vendor books a FREELANCER expense (one per job, enforced by a unique key);
 * marking it unpaid again removes that expense so the books stay consistent.
 */
export async function setPaymentStatus(id: string, paid: boolean): Promise<ActionResult> {
  const { user, error } = await guardAction("outsourced:payment", id);
  if (!user) return { ok: false, error };
  const job = await prisma.outsourcedWork.findUnique({
    where: { id },
    select: { agreementCost: true, vendorId: true, workOrderId: true, vendor: { select: { name: true } }, workOrder: { select: { orderNo: true } } },
  });
  if (!job) return { ok: false, error: "This job no longer exists." };

  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.outsourcedWork.updateMany({
      where: { id, paymentStatus: paid ? "UNPAID" : "PAID" },
      data: { paymentStatus: paid ? "PAID" : "UNPAID" },
    });
    if (count === 0) return false; // already in that state (double click / another user)
    if (paid) {
      await tx.expense.create({
        data: {
          category: "FREELANCER",
          amount: job.agreementCost,
          vatAmount: 0,
          description: `Freelancer payment — ${job.vendor.name} (${job.workOrder.orderNo})`,
          date: new Date(),
          vendorId: job.vendorId,
          outsourcedWorkId: id,
        },
      });
    } else {
      await tx.expense.deleteMany({ where: { outsourcedWorkId: id } });
    }
    await tx.activityLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: job.workOrderId,
        action: paid ? "vendor_paid" : "vendor_unpaid",
        message: paid ? `Paid ${job.vendor.name} QAR ${job.agreementCost.toFixed(2)} (expense booked)` : `Payment to ${job.vendor.name} reversed (expense removed)`,
        userId: user.id,
      },
    });
    return true;
  });
  if (!changed) return { ok: false, error: `This job is already marked ${paid ? "paid" : "unpaid"}.` };
  refresh(job.workOrderId);
  return { ok: true, data: undefined };
}

/** Vendor's delivered file → a Document on the work order (and this job); marks the job received. */
export async function uploadDelivery(id: string, formData: FormData): Promise<ActionResult> {
  const { user, error } = await guardAction("outsourced:edit", id);
  if (!user) return { ok: false, error };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };
  const job = await prisma.outsourcedWork.findUnique({
    where: { id },
    select: { receivedAt: true, vendor: { select: { name: true } }, workOrder: { select: { id: true, orderNo: true, customerId: true, deletedAt: true } } },
  });
  if (!job || job.workOrder.deletedAt) return { ok: false, error: "This job no longer exists." };

  let stored;
  try {
    stored = await saveUpload(file);
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    throw e;
  }
  const name = `${job.vendor.name} delivery — ${job.workOrder.orderNo} (${formatLocal(new Date(), "d MMM")})`.slice(0, 160);
  await prisma.$transaction([
    prisma.document.create({
      data: { name, category: "OTHER", ...stored, customerId: job.workOrder.customerId, workOrderId: job.workOrder.id, outsourcedWorkId: id, uploadedById: user.id },
    }),
    ...(job.receivedAt ? [] : [prisma.outsourcedWork.update({ where: { id }, data: { receivedAt: new Date() } })]),
    prisma.activityLog.create({
      data: { entityType: "WorkOrder", entityId: job.workOrder.id, action: "vendor_delivered", message: `${job.vendor.name} delivered a file`, userId: user.id },
    }),
  ]);
  refresh(job.workOrder.id);
  revalidatePath("/documents");
  return { ok: true, data: undefined };
}
