"use server";

import { revalidatePath } from "next/cache";
import { addDays, max } from "date-fns";
import type { OrgStatus } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getCurrentUser } from "@/lib/auth/session";
import { basePrisma } from "@/lib/db/base";

/** Owner-only actions on any center. */
async function guardPlatform(orgId: unknown) {
  const user = await getCurrentUser();
  if (!user || !isPlatformAdmin(user.email)) return { error: "You don't have permission to do that." };
  if (typeof orgId !== "string" || !/^[\w-]{1,64}$/.test(orgId)) return { error: "Invalid request." };
  const org = await basePrisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, trialEndsAt: true } });
  if (!org) return { error: "That center no longer exists." };
  return { user, org };
}

// No userId: the owner's account belongs to another center, and logs only link users of their own center.
const log = (organizationId: string, message: string) =>
  basePrisma.activityLog.create({ data: { organizationId, entityType: "Organization", entityId: organizationId, action: "platform", message } });

/** Gives a center 30 more trial days (from today or from its current end, whichever is later). */
export async function extendTrial(orgId: string): Promise<ActionResult> {
  const g = await guardPlatform(orgId);
  if (!g.org) return { ok: false, error: g.error };
  const trialEndsAt = addDays(max([new Date(), g.org.trialEndsAt ?? new Date()]), 30);
  await basePrisma.organization.update({ where: { id: g.org.id }, data: { status: "TRIAL", trialEndsAt } });
  await log(g.org.id, "TypeDesk extended the free trial by 30 days");
  revalidatePath("/platform");
  return { ok: true, data: undefined };
}

/** ACTIVE = paying (no trial limit), SUSPENDED = locked out (data kept). */
export async function setCenterStatus(orgId: string, status: OrgStatus): Promise<ActionResult> {
  const g = await guardPlatform(orgId);
  if (!g.org) return { ok: false, error: g.error };
  if (status !== "ACTIVE" && status !== "SUSPENDED") return { ok: false, error: "Invalid request." };
  if (status === "SUSPENDED" && g.org.id === g.user.organizationId) return { ok: false, error: "You can't suspend your own center." };
  await basePrisma.organization.update({ where: { id: g.org.id }, data: { status } });
  await log(g.org.id, status === "ACTIVE" ? "TypeDesk activated the account" : "TypeDesk suspended the account");
  revalidatePath("/platform");
  return { ok: true, data: undefined };
}
