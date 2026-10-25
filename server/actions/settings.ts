"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { UploadError, saveUpload } from "@/lib/storage";
import { settingsSchema, type SettingsFormValues } from "@/lib/validation/settings";

const MAX_LOGO_BYTES = 1024 * 1024; // embedded in every invoice PDF

function setValues(values: Record<string, string>, userId: string, message: string) {
  return prisma.$transaction([
    ...Object.entries(values).map(([key, value]) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
    prisma.activityLog.create({ data: { entityType: "Setting", entityId: "settings", action: "updated", message, userId } }),
  ]);
}

/** Company details, VAT rate and invoice terms. Existing invoices keep the VAT rate they were issued with. */
export async function saveSettings(input: SettingsFormValues): Promise<ActionResult> {
  const { user, error } = await guardAction("settings:manage");
  if (!user) return { ok: false, error };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const { vatPercent, ...company } = parsed.data;
  const vatRate = new Prisma.Decimal(vatPercent).div(100);
  const before = (await getSettings()).vatRate;

  await setValues(
    { ...company, vatRate: vatRate.toString() },
    user.id,
    before.equals(vatRate) ? "Updated company settings" : `Updated company settings; VAT rate ${before.times(100)}% → ${vatPercent}%`,
  );
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Upload (PNG/JPG) or remove (no file) the logo printed on invoices and quotations. */
export async function saveLogo(formData: FormData): Promise<ActionResult> {
  const { user, error } = await guardAction("settings:manage");
  if (!user) return { ok: false, error };

  const file = formData.get("logo");
  let fileUrl = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "The logo must be 1 MB or smaller." };
    try {
      fileUrl = (await saveUpload(file, ["png", "jpg"])).fileUrl;
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, error: e.message };
      throw e;
    }
  }
  // The old file stays in storage (like soft-deleted documents); it's just no longer served.
  await setValues({ companyLogo: fileUrl }, user.id, fileUrl ? "Uploaded a new company logo" : "Removed the company logo");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
