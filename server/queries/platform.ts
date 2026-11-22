import "server-only";
import { basePrisma } from "@/lib/db/base";

/** Every center with its first admin and a few counts (owner's /platform page; crosses centers on purpose). */
export function listCenters() {
  return basePrisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      trialEndsAt: true,
      createdAt: true,
      _count: { select: { users: true, customers: true, workOrders: true, invoices: true } },
      users: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { name: true, email: true, emailVerifiedAt: true, lastLoginAt: true },
      },
    },
  });
}

export type CenterRow = Awaited<ReturnType<typeof listCenters>>[number];
