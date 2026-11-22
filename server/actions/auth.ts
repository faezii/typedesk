"use server";

import { AuthError } from "next-auth";
import { after } from "next/server";
import { sendConfirmationEmail } from "@/lib/auth/confirm-email";
import { rateLimited } from "@/lib/auth/rate-limit";
import { basePrisma } from "@/lib/db/base";
import { z } from "zod";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  callbackUrl: z.string().optional(),
});

/** Only allow same-site relative redirects. */
function safeRedirect(url: string | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/login")) return "/";
  return url;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirect(parsed.data.callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "unconfirmed") {
        // Only reached with the right password, so saying the account exists reveals nothing new.
        if (!(await rateLimited("confirm_email"))) after(async () => {
          const user = await basePrisma.user.findUnique({ where: { email: parsed.data.email.trim().toLowerCase() }, select: { id: true, name: true, email: true } });
          if (user) await sendConfirmationEmail(user);
        });
        return { email, error: "Confirm your email first: we've sent a new confirmation link. Check your inbox." };
      }
      return {
        email,
        error:
          code === "rate_limited"
            ? "Too many failed attempts. Please wait 15 minutes and try again."
            : "Invalid email or password.",
      };
    }
    throw error; // NEXT_REDIRECT on success
  }
  return {};
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
