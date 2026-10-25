import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type Permission } from "./permissions";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * The signed-in user, re-read from the database once per request so that
 * deactivated users and role changes take effect immediately.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, department: true, isActive: true, mustChangePassword: true },
  });
  return user?.isActive ? user : null;
});

/** For pages/layouts: redirect to /login when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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

/** For server actions that return ActionResult: `{ user }` or `{ error }` instead of throwing. */
export async function guardAction(permission: Permission): Promise<{ user: CurrentUser; error?: undefined } | { error: string; user?: undefined }> {
  try {
    return { user: await requirePermission(permission) };
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: e.message };
    throw e;
  }
}

/** For server actions: throws instead of redirecting. */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Please sign in again.");
  if (!can(user.role, permission)) throw new AuthorizationError();
  return user;
}
