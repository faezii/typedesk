import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

// Basic brute-force protection: 5 failed attempts per email per 15 minutes.
// In-memory, so it is per server instance — swap for Redis/Upstash when scaling out.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

function isLocked(email: string) {
  const entry = failures.get(email);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(email);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(email: string) {
  const entry = failures.get(email);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(email, { count: 1, first: Date.now() });
  else entry.count++;
}

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        if (isLocked(email)) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok || !user.isActive) {
          recordFailure(email);
          return null;
        }

        failures.delete(email);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
      },
    }),
  ],
});
