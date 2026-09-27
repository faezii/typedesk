import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Dashboard" };

// Phase 2 placeholder — the full dashboard is built in Phase 3.
export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const [customers, workOrders, invoices] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.workOrder.count({ where: { deletedAt: null } }),
    prisma.invoice.count({ where: { deletedAt: null } }),
  ]);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="The full dashboard arrives in Phase 3." />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Customers", customers],
          ["Work orders", workOrders],
          ["Invoices", invoices],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-xl border p-5">
            <div className="text-muted-foreground text-sm">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </>
  );
}
