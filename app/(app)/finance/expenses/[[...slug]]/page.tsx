import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Expenses" };

// Placeholder (optional catch-all so detail links like /finance/expenses/<id> resolve) — replaced in Phase 8.
export default async function Page() {
  await requirePagePermission("finance:view");
  return <ComingSoon title="Expenses" description="Office expenses and receipts." phase={8} />;
}
