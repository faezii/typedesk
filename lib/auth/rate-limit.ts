import "server-only";
import { headers } from "next/headers";
import { basePrisma } from "@/lib/db/base";

const HOUR = 60 * 60 * 1000;
const KEEP = 24 * HOUR;

/** Attempts allowed per IP and window. Kept in the database, so every server instance counts the same. */
export const LIMITS = {
  signup: { limit: 5, windowMs: HOUR },
  password_reset: { limit: 10, windowMs: HOUR },
  confirm_email: { limit: 10, windowMs: HOUR },
} as const;

type Db = { rateLimit: Pick<typeof basePrisma.rateLimit, "count" | "create" | "deleteMany"> };

/** True when `key` already used its `limit` in the window (nothing is recorded then); otherwise records this attempt. */
export async function overLimit(db: Db, key: string, limit: number, windowMs: number, now = new Date()) {
  await db.rateLimit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP) } } }); // rows older than a day are never needed
  const recent = await db.rateLimit.count({ where: { key, createdAt: { gt: new Date(now.getTime() - windowMs) } } });
  if (recent >= limit) return true;
  await db.rateLimit.create({ data: { key } });
  return false;
}

/** The visitor's IP as Vercel reports it (it overwrites these headers, so clients can't fake them there). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Counts one `action` from this visitor's IP; true = over the limit, refuse the request. */
export async function rateLimited(action: keyof typeof LIMITS) {
  const { limit, windowMs } = LIMITS[action];
  return overLimit(basePrisma, `${action}:${await clientIp()}`, limit, windowMs);
}
