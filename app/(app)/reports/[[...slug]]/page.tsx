import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Reports" };

// Placeholder (optional catch-all so detail links like /reports/<id> resolve) — replaced in Phase 9.
export default async function Page() {
  await requirePagePermission("reports:view");
  return <ComingSoon title="Reports" description="Sales, VAT, productivity and collection reports." phase={9} />;
}
