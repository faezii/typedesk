import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { basePrisma } from "@/lib/db/base";

/** One-time links sent by email. Only the SHA-256 of a token is stored. */
export type TokenPurpose = "password_reset" | "verify_email";

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");
type Db = Pick<typeof basePrisma, "authToken">;

/** A new token for the user, or null when they already had `maxPerHour` this hour. */
export async function issueToken(userId: string, purpose: TokenPurpose, validMinutes: number, maxPerHour: number) {
  const recent = await basePrisma.authToken.count({ where: { userId, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent >= maxPerHour) return null;
  const token = randomBytes(32).toString("base64url");
  await basePrisma.authToken.create({ data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + validMinutes * 60 * 1000) } });
  return token;
}

/**
 * Uses up a token inside the caller's transaction. Returns its user, or null when the token is
 * unknown, expired, already used or belongs to a deactivated user. Of two simultaneous uses only one wins.
 */
export async function claimToken(tx: Db, token: string, purpose: TokenPurpose) {
  const row = await tx.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, isActive: true, organizationId: true } } } });
  if (!row || row.purpose !== purpose || row.expiresAt < new Date() || !row.user.isActive) return null;
  const claimed = await tx.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return null;
  await tx.authToken.deleteMany({ where: { userId: row.userId, purpose, id: { not: row.id } } });
  return row.user;
}
