import "server-only";
import { prisma } from "@/lib/prisma";

export async function listServices() {
  const services = await prisma.service.findMany({
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { title: "asc" }],
    include: { _count: { select: { workOrders: { where: { deletedAt: null } } } } },
  });
  return services.map((s) => ({ ...s, defaultPrice: s.defaultPrice.toFixed(2), orders: s._count.workOrders }));
}
