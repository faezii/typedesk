import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Phase 1 placeholder — replaced by the dashboard in Phase 3.
export default async function Home() {
  const [customers, workOrders, invoices] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.workOrder.count({ where: { deletedAt: null } }),
    prisma.invoice.count({ where: { deletedAt: null } }),
  ]);
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-semibold">ProcureFlow</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Database connected · {customers} customers · {workOrders} work orders · {invoices} invoices
      </p>
    </main>
  );
}
