import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Customers" };

// Placeholder (optional catch-all so detail links like /customers/<id> resolve) — replaced in Phase 4.
export default async function Page() {
  await requirePagePermission("customers:view");
  return <ComingSoon title="Customers" description="Client profiles, IDs and balances." phase={4} />;
}
