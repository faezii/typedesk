import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Invoices & Quotes" };

// Placeholder (optional catch-all so detail links like /finance/invoices/<id> resolve) — replaced in Phase 8.
export default async function Page() {
  await requirePagePermission("finance:view");
  return <ComingSoon title="Invoices & Quotes" description="UAE tax invoices and quotations." phase={8} />;
}
