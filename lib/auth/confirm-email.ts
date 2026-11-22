import "server-only";
import { issueToken } from "@/lib/auth/tokens";
import { appUrl, sendEmail } from "@/lib/email";

export const CONFIRM_HOURS = 48;

/** Emails a sign-up confirmation link (at most 3 an hour). Not a server action: callers pass a user they looked up. */
export async function sendConfirmationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "verify_email", CONFIRM_HOURS * 60, 3);
  if (!token) return;
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for TypeDesk",
    text: [
      `Hello ${user.name},`,
      "",
      "Welcome to TypeDesk. Confirm your email to start using your center's account:",
      "",
      `${appUrl()}/verify-email?token=${token}`,
      "",
      `The link works for ${CONFIRM_HOURS} hours. If you didn't sign up, ignore this email.`,
    ].join("\n"),
  });
}
