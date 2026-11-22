import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { basePrisma } from "@/lib/db/base";
import { can, type Permission } from "./permissions";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * The signed-in user, re-read from the database once per request so that
 * deactivated users and role changes take effect immediately.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await basePrisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true, department: true, isActive: true, mustChangePassword: true, organizationId: true,
      organization: { select: { name: true, status: true, trialEndsAt: true } },
    },
  });
  return user?.isActive ? user : null;
});

/** The signed-in user's center, for lib/prisma's scoping. Throws outside a signed-in request. */
export async function currentOrgId() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Please sign in again.");
  return user.organizationId;
}

/** Why the center can't work right now (trial over, suspended), or null. */
export function centerBlocked(org: CurrentUser["organization"], now = new Date()): string | null {
  if (org.status === "SUSPENDED") return "This center's account is suspended.";
  if (org.status === "TRIAL" && org.trialEndsAt && org.trialEndsAt < now) return "Your free trial has ended.";
  return null;
}

/** For pages/layouts: redirect to /login when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (centerBlocked(user.organization)) redirect("/blocked"); // before the page loads any data
  return user;
}

/** For pages: redirect to /forbidden when the role lacks the permission. */
export async function requirePagePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/forbidden");
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const idSchema = z.string().regex(/^[\w-]{1,64}$/).nullable();

/**
 * For server actions that return ActionResult: `{ user }` or `{ error }` instead of throwing.
 * Pass every record id the action received from the client (null = "create"): a crafted request
 * could otherwise send a Prisma filter such as `{ not: "" }` and match every row.
 */
export async function guardAction(
  permission: Permission,
  ...ids: unknown[]
): Promise<{ user: CurrentUser; error?: undefined } | { error: string; user?: undefined }> {
  try {
    const user = await requirePermission(permission);
    if (!ids.every((id) => idSchema.safeParse(id).success)) return { error: "Invalid request." };
    return { user };
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: e.message };
    throw e;
  }
}

/** For server actions: throws instead of redirecting. */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Please sign in again.");
  const blocked = centerBlocked(user.organization);
  if (blocked) throw new AuthorizationError(blocked);
  if (!can(user.role, permission)) throw new AuthorizationError();
  return user;
}
