import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { basePrisma?: PrismaClient };

/**
 * The unscoped client. Sees every center's rows — use it only where there is no signed-in center yet
 * (sign-in, sign-up, password reset, the owner's /platform page). Everything else uses `prisma` from lib/prisma.
 */
export const basePrisma =
  globalForPrisma.basePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.basePrisma = basePrisma;
