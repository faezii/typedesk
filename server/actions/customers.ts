"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { customerSchema, type CustomerFormValues } from "@/lib/validation/customer";
import { syncIdExpiryFollowUps } from "@/server/services/expiry-follow-ups";

/** Create (id = null) or update a customer; keeps ID-expiry follow-ups in sync. */
export async function saveCustomer(id: string | null, input: CustomerFormValues): Promise<ActionResult<{ id: string }>> {
  let user;
  try {
    user = await requirePermission("customers:edit");
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { emiratesIdExpiry, passportExpiry, companyName, type, ...rest } = parsed.data;
  const data = {
    ...rest,
    type,
    companyName: type === "COMPANY" ? companyName : null,
    emiratesIdExpiry: parseDateInput(emiratesIdExpiry),
    passportExpiry: parseDateInput(passportExpiry),
  };

  if (data.emiratesId) {
    const dupe = await prisma.customer.findFirst({
      where: { emiratesId: data.emiratesId, deletedAt: null, ...(id ? { id: { not: id } } : {}) },
      select: { name: true },
    });
    if (dupe) return { ok: false, error: "Duplicate Emirates ID.", fieldErrors: { emiratesId: `Already registered to ${dupe.name}` } };
  }

  const saved = await prisma.$transaction(async (tx) => {
    if (id) {
      const exists = await tx.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!exists) return null;
    }
    const customer = id ? await tx.customer.update({ where: { id }, data }) : await tx.customer.create({ data });
    await syncIdExpiryFollowUps(tx, customer, user.id);
    await tx.activityLog.create({
      data: {
        entityType: "Customer",
        entityId: customer.id,
        action: id ? "updated" : "created",
        message: `${id ? "Updated" : "Created"} customer ${customer.name}`,
        userId: user.id,
      },
    });
    return customer;
  });
  if (!saved) return { ok: false, error: "This customer no longer exists." };

  revalidatePath("/customers", "layout");
  revalidatePath("/follow-ups");
  revalidatePath("/");
  return { ok: true, data: { id: saved.id } };
}
