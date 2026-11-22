import { currentOrgId } from "@/lib/auth/session";
import { basePrisma } from "@/lib/db/base";
import { withTenant } from "@/lib/db/tenant";

/**
 * The app's database client, limited to the signed-in user's center: every query and write gets
 * its organizationId (lib/db/tenant.ts). Outside a signed-in request it throws instead of
 * guessing. For cross-center work (sign-in, sign-up, password reset, /platform) use basePrisma.
 */
export const prisma = withTenant(basePrisma, currentOrgId);

/** The `tx` inside `prisma.$transaction(async (tx) => …)`: also center-scoped. */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
