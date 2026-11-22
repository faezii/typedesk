"use server";

import { after } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { claimToken, issueToken } from "@/lib/auth/tokens";
import { basePrisma as prisma } from "@/lib/db/base";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { passwordResetSchema } from "@/lib/validation/team";

const VALID_MINUTES = 30;

export type ForgotState = { sent?: boolean; error?: string; email?: string };

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address", email };
  if (!emailConfigured()) return { error: "Password reset by email isn't set up yet. Ask your administrator to reset your password.", email };

  // The lookup and the email run after the response, so the reply (and its timing) is the same
  // whether or not the address has an account.
  after(async () => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true } });
    if (!user?.isActive) return;
    const token = await issueToken(user.id, "password_reset", VALID_MINUTES, 3);
    if (!token) return;
    await sendEmail({
      to: email,
      subject: "Reset your TypeDesk password",
      text: [
        `Hello ${user.name},`,
        "",
        "Someone (hopefully you) asked to reset the password for your TypeDesk account.",
        `Choose a new password here (the link works once, for ${VALID_MINUTES} minutes):`,
        "",
        `${appUrl()}/reset-password?token=${token}`,
        "",
        "If you didn't ask for this, ignore this email; your password stays the same.",
      ].join("\n"),
    });
  });
  return { sent: true, email };
}

export type ResetState = { done?: boolean; error?: string; fieldErrors?: Record<string, string> };

const INVALID = "This reset link is invalid or has expired. Request a new one.";

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = passwordResetSchema.safeParse({ token: formData.get("token"), next: formData.get("next"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return fieldErrors.token ? { error: INVALID } : { error: parsed.error.issues[0]!.message, fieldErrors };
  }

  const passwordHash = await bcrypt.hash(parsed.data.next, 10);
  const done = await prisma.$transaction(async (tx) => {
    const user = await claimToken(tx, parsed.data.token, "password_reset");
    if (!user) return false;
    // A working reset link also proves the address, so it confirms an unconfirmed sign-up too.
    const { emailVerifiedAt } = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true } });
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, emailVerifiedAt: emailVerifiedAt ?? new Date() } });
    await tx.activityLog.create({ data: { organizationId: user.organizationId, entityType: "User", entityId: user.id, action: "password_reset", message: "Reset password with an emailed link", userId: user.id } });
    return true;
  });
  return done ? { done: true } : { error: INVALID };
}
