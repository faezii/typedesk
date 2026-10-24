"use server";

import { revalidatePath } from "next/cache";
import { DocumentCategory } from "@prisma/client";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { DOCUMENT_CATEGORY_LABEL, EXPIRING_CATEGORIES } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { UploadError, saveUpload } from "@/lib/storage";
import { customerWorkOrderOptions } from "@/server/queries/documents";
import { searchCustomers } from "@/server/queries/customers";
import { syncIdExpiryFollowUps } from "@/server/services/expiry-follow-ups";

const uploadSchema = z.object({
  name: z.string().trim().min(1, "Enter a document name").max(160),
  category: z.enum(DocumentCategory, "Choose a category"),
  customerId: z.string().trim().optional().transform((v) => v || null),
  workOrderId: z.string().trim().optional().transform((v) => v || null),
  expiryDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date"),
});

async function guard(permission: "documents:edit" | "documents:view") {
  try {
    return { user: await requirePermission(permission) };
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: e.message };
    throw e;
  }
}

export async function uploadDocument(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const g = await guard("documents:edit");
  if (!g.user) return { ok: false, error: g.error! };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };
  const parsed = uploadSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([k]) => k !== "file")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { name, category, expiryDate } = parsed.data;
  let { customerId } = parsed.data;
  const { workOrderId } = parsed.data;

  if (workOrderId) {
    const wo = await prisma.workOrder.findFirst({ where: { id: workOrderId, deletedAt: null }, select: { customerId: true } });
    if (!wo) return { ok: false, error: "That work order no longer exists." };
    if (customerId && wo.customerId !== customerId) return { ok: false, error: "The work order belongs to a different customer." };
    customerId = wo.customerId;
  }
  if (customerId && !(await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { id: true } }))) {
    return { ok: false, error: "That customer no longer exists." };
  }

  let stored;
  try {
    stored = await saveUpload(file);
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    throw e;
  }

  const expiry = EXPIRING_CATEGORIES.includes(category) ? parseDateInput(expiryDate) : null;
  const user = g.user;

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { name, category, ...stored, customerId, workOrderId, expiryDate: expiry, uploadedById: user.id },
    });
    // A newly uploaded passport / Emirates ID becomes the customer's current ID expiry.
    if (customerId && expiry && (category === "PASSPORT" || category === "EMIRATES_ID")) {
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: category === "PASSPORT" ? { passportExpiry: expiry } : { emiratesIdExpiry: expiry },
      });
      await syncIdExpiryFollowUps(tx, customer, user.id);
    }
    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: created.id,
        action: "uploaded",
        message: `Uploaded ${DOCUMENT_CATEGORY_LABEL[category]} "${name}"`,
        userId: user.id,
      },
    });
    return created;
  });

  revalidatePath("/documents");
  revalidatePath("/customers", "layout");
  revalidatePath("/follow-ups");
  return { ok: true, data: { id: doc.id } };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const g = await guard("documents:edit");
  if (!g.user) return { ok: false, error: g.error! };

  const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
  if (!doc) return { ok: false, error: "Document not found." };
  // Soft delete: the file stays on disk for audit, but is no longer served.
  await prisma.$transaction([
    prisma.document.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.activityLog.create({
      data: { entityType: "Document", entityId: id, action: "deleted", message: `Deleted document "${doc.name}"`, userId: g.user.id },
    }),
  ]);
  revalidatePath("/documents");
  revalidatePath("/customers", "layout");
  return { ok: true, data: undefined };
}

/** Picker lookups for the upload dialog. */
export async function findCustomers(q: string) {
  const g = await guard("documents:view");
  if (!g.user || q.trim().length < 2) return [];
  return searchCustomers(q);
}

export async function findCustomerWorkOrders(customerId: string) {
  const g = await guard("documents:view");
  if (!g.user || !customerId) return [];
  return customerWorkOrderOptions(customerId);
}
