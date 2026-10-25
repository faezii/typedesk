"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validation/team";

export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };

  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(parsed.data.current, row.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 10), mustChangePassword: false } });
  await prisma.activityLog.create({ data: { entityType: "User", entityId: user.id, action: "password_changed", message: "Changed own password", userId: user.id } });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
