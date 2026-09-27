import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Profit & Loss" };

// Placeholder (optional catch-all so detail links like /finance/profit-loss/<id> resolve) — replaced in Phase 8.
export default async function Page() {
  await requirePagePermission("finance:view");
  return <ComingSoon title="Profit & Loss" description="Income vs expenses and net profit." phase={8} />;
}
