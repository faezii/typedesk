import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Work Orders" };

// Placeholder (optional catch-all so detail links like /work-orders/<id> resolve) — replaced in Phase 5.
export default async function Page() {
  await requirePagePermission("workOrders:view");
  return <ComingSoon title="Work Orders" description="Track every job from receipt to delivery." phase={5} />;
}
