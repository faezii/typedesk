import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Payments" };

// Placeholder (optional catch-all so detail links like /finance/payments/<id> resolve) — replaced in Phase 8.
export default async function Page() {
  await requirePagePermission("finance:view");
  return <ComingSoon title="Payments" description="Collections by method and day." phase={8} />;
}
