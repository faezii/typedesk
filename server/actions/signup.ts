"use server";

import { after } from "next/server";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { sendConfirmationEmail } from "@/lib/auth/confirm-email";
import { claimToken } from "@/lib/auth/tokens";
import { basePrisma } from "@/lib/db/base";
import { emailConfigured } from "@/lib/email";
import { signUpSchema, TRIAL_DAYS } from "@/lib/validation/signup";

export type SignUpState = { done?: boolean; email?: string; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const values = { center: raw.center ?? "", name: raw.name ?? "", email: raw.email ?? "", phone: raw.phone ?? "" };
  if (raw.website) return { done: true, email: values.email }; // honeypot: a bot gets a fake success
  if (!emailConfigured()) return { error: "Sign-up isn't available right now. Please try again later.", values };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  }
  const d = parsed.data;
  const taken = { error: "An account with this email already exists. Sign in, or use Forgot password.", fieldErrors: { email: "Already registered" }, values };
  if (await basePrisma.user.findUnique({ where: { email: d.email }, select: { id: true } })) return taken;

  let user: { id: string; name: string; email: string };
  try {
    const org = await basePrisma.organization.create({
      data: {
        name: d.center,
        phone: d.phone,
        status: "TRIAL",
        trialEndsAt: addDays(new Date(), TRIAL_DAYS),
        users: { create: { name: d.name, email: d.email, phone: d.phone, passwordHash: await bcrypt.hash(d.password, 10), role: "ADMIN", department: "MANAGEMENT" } },
        settings: {
          create: [
            { key: "companyName", value: d.center },
            { key: "companyEmail", value: d.email },
            { key: "vatRate", value: "0" },
            ...(d.phone ? [{ key: "companyPhone", value: d.phone }] : []),
          ],
        },
      },
      select: { id: true, users: { select: { id: true, name: true, email: true } } },
    });
    user = org.users[0]!;
    await basePrisma.activityLog.create({ data: { organizationId: org.id, entityType: "Organization", entityId: org.id, action: "created", message: `Signed up ${d.center} (${TRIAL_DAYS}-day trial)`, userId: user.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return taken; // same email, a moment earlier
    throw e;
  }
  after(() => sendConfirmationEmail(user));
  return { done: true, email: d.email };
}

export type VerifyState = { done?: boolean; error?: string };

export async function verifyEmail(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const token = String(formData.get("token") ?? "");
  if (token.length < 20 || token.length > 200) return { error: "This confirmation link is invalid or has expired." };
  const ok = await basePrisma.$transaction(async (tx) => {
    const user = await claimToken(tx, token, "verify_email");
    if (!user) return false;
    await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return true;
  });
  return ok ? { done: true } : { error: "This confirmation link is invalid or has expired." };
}
