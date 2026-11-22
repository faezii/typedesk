"use server";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { passwordResetSchema } from "@/lib/validation/team";

const PURPOSE = "password_reset";
const VALID_MINUTES = 30;
const MAX_PER_HOUR = 3;

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

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
    const recent = await prisma.authToken.count({ where: { userId: user.id, purpose: PURPOSE, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= MAX_PER_HOUR) return;

    const token = randomBytes(32).toString("base64url");
    await prisma.authToken.create({
      data: { userId: user.id, purpose: PURPOSE, tokenHash: sha256(token), expiresAt: new Date(Date.now() + VALID_MINUTES * 60 * 1000) },
    });
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
  const userId = await prisma.$transaction(async (tx) => {
    const row = await tx.authToken.findUnique({ where: { tokenHash: sha256(parsed.data.token) }, include: { user: { select: { isActive: true } } } });
    if (!row || row.purpose !== PURPOSE || row.expiresAt < new Date() || !row.user.isActive) return null;
    // Claim the token first: of two simultaneous submits, only one sees count = 1.
    const claimed = await tx.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) return null;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.authToken.deleteMany({ where: { userId: row.userId, purpose: PURPOSE, id: { not: row.id } } });
    await tx.activityLog.create({ data: { entityType: "User", entityId: row.userId, action: "password_reset", message: "Reset password with an emailed link", userId: row.userId } });
    return row.userId;
  });
  return userId ? { done: true } : { error: INVALID };
}
