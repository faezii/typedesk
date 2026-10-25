"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { UploadError, saveUpload } from "@/lib/storage";
import { expenseSchema } from "@/lib/validation/finance";

function refresh() {
  revalidatePath("/finance", "layout");
  revalidatePath("/");
}

/** Create or edit a manual expense; an attached receipt (FormData "receipt") replaces the old one. */
export async function saveExpense(id: string | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return { ok: false, error };
  const fields = Object.fromEntries([...formData.entries()].filter(([k]) => k !== "receipt").map(([k, v]) => [k, String(v)]));
  const parsed = expenseSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = parsed.data;

  if (id) {
    const existing = await prisma.expense.findUnique({ where: { id }, select: { outsourcedWorkId: true } });
    if (!existing) return { ok: false, error: "This expense no longer exists." };
    // Vendor payments are owned by the outsourcing workflow so the job and the books stay in step.
    if (existing.outsourcedWorkId) return { ok: false, error: "This expense comes from an outsourced job. Change it from Outsourced work." };
  }
  if (d.vendorId && !(await prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { id: true } }))) return { ok: false, error: "That vendor no longer exists." };

  let receiptUrl: string | undefined;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    try {
      receiptUrl = (await saveUpload(receipt)).fileUrl;
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, error: e.message, fieldErrors: { receipt: e.message } };
      throw e;
    }
  }

  const data = {
    category: d.category,
    amount: d.amount,
    vatAmount: d.vatAmount,
    description: d.description,
    date: parseDateInput(d.date)!,
    vendorId: d.vendorId,
    ...(receiptUrl ? { receiptUrl } : {}),
  };
  const expense = id ? await prisma.expense.update({ where: { id }, data }) : await prisma.expense.create({ data });
  await prisma.activityLog.create({
    data: { entityType: "Expense", entityId: expense.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Recorded"} ${d.category.toLowerCase()} expense QAR ${expense.amount.toFixed(2)} — ${d.description}`, userId: user.id },
  });
  refresh();
  return { ok: true, data: { id: expense.id } };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return { ok: false, error };
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) return { ok: false, error: "This expense no longer exists." };
  if (e.outsourcedWorkId) return { ok: false, error: "This expense comes from an outsourced job. Mark the job unpaid instead." };
  await prisma.$transaction([
    prisma.expense.delete({ where: { id } }),
    // Keep a full copy in the audit log, since the row itself is removed.
    prisma.activityLog.create({
      data: { entityType: "Expense", entityId: id, action: "deleted", message: `Deleted ${e.category.toLowerCase()} expense QAR ${e.amount.toFixed(2)} (VAT ${e.vatAmount.toFixed(2)}) dated ${e.date.toISOString().slice(0, 10)} — ${e.description}`, userId: user.id },
    }),
  ]);
  refresh();
  return { ok: true, data: undefined };
}
