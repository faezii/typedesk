"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/permissions";
import { guardAction, type CurrentUser } from "@/lib/auth/session";
import { generateTempPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validation/team";

/** Only admins may create, change or reset ADMIN accounts, or grant the ADMIN role. */
function mayManage(actor: CurrentUser, targetRole: Role | null, newRole?: Role) {
  return can(actor.role, "employees:manageAdmins") || (targetRole !== "ADMIN" && newRole !== "ADMIN");
}

async function otherActiveAdmins(excludeId: string) {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: excludeId } } });
}

const log = (userId: string, entityId: string, action: string, message: string) =>
  prisma.activityLog.create({ data: { entityType: "User", entityId, action, message, userId } });

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

/** Creates the account with a one-time temporary password, returned once for the admin to hand over. */
export async function createEmployee(input: EmployeeFormValues): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  const { user, error } = await guardAction("employees:edit");
  if (!user) return { ok: false, error };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (!mayManage(user, null, d.role)) return { ok: false, error: "Only an admin can create admin accounts.", fieldErrors: { role: "Not allowed" } };
  if (await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })) {
    return { ok: false, error: "That email is already in use.", fieldErrors: { email: "Already in use" } };
  }

  const tempPassword = generateTempPassword();
  const created = await prisma.user.create({ data: { ...d, passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true } });
  await log(user.id, created.id, "created", `Created ${d.role.toLowerCase()} account for ${d.name}`);
  revalidatePath("/employees");
  return { ok: true, data: { id: created.id, tempPassword } };
}

export async function updateEmployee(id: string, input: EmployeeFormValues): Promise<ActionResult> {
  const { user, error } = await guardAction("employees:edit", id);
  if (!user) return { ok: false, error };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  if (!target) return { ok: false, error: "Employee not found." };
  if (!mayManage(user, target.role, d.role)) return { ok: false, error: "Only an admin can change admin accounts or grant the admin role." };
  if (id === user.id && d.role !== target.role) return { ok: false, error: "You can't change your own role.", fieldErrors: { role: "Ask another admin" } };
  if (target.role === "ADMIN" && d.role !== "ADMIN" && target.isActive && (await otherActiveAdmins(id)) === 0) {
    return { ok: false, error: "This is the last active admin. Make someone else an admin first.", fieldErrors: { role: "Last admin" } };
  }
  const clash = await prisma.user.findFirst({ where: { email: d.email, id: { not: id } }, select: { id: true } });
  if (clash) return { ok: false, error: "That email is already in use.", fieldErrors: { email: "Already in use" } };

  await prisma.user.update({ where: { id }, data: d });
  await log(user.id, id, "updated", `Updated ${d.name}${d.role !== target.role ? ` (role ${target.role} → ${d.role})` : ""}`);
  revalidatePath("/employees");
  return { ok: true, data: undefined };
}

/** Deactivated users can't sign in; their history stays. Takes effect on their next request. */
export async function setEmployeeActive(id: string, active: boolean): Promise<ActionResult> {
  const { user, error } = await guardAction("employees:edit", id);
  if (!user) return { ok: false, error };
  if (id === user.id) return { ok: false, error: "You can't deactivate your own account." };
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) return { ok: false, error: "Employee not found." };
  if (!mayManage(user, target.role)) return { ok: false, error: "Only an admin can deactivate an admin." };
  if (!active && target.role === "ADMIN" && (await otherActiveAdmins(id)) === 0) return { ok: false, error: "This is the last active admin." };

  await prisma.user.update({ where: { id }, data: { isActive: Boolean(active) } });
  await log(user.id, id, active ? "activated" : "deactivated", `${active ? "Reactivated" : "Deactivated"} ${target.name}`);
  revalidatePath("/employees");
  return { ok: true, data: undefined };
}

/** Issues a new temporary password (shown once) and asks the user to choose their own on next sign-in. */
export async function resetEmployeePassword(id: string): Promise<ActionResult<{ tempPassword: string }>> {
  const { user, error } = await guardAction("employees:edit", id);
  if (!user) return { ok: false, error };
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) return { ok: false, error: "Employee not found." };
  if (!mayManage(user, target.role)) return { ok: false, error: "Only an admin can reset an admin's password." };

  const tempPassword = generateTempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true } });
  await log(user.id, id, "password_reset", `Reset password for ${target.name}`);
  revalidatePath("/employees");
  return { ok: true, data: { tempPassword } };
}
