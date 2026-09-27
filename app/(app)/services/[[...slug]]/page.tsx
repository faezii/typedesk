import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Services" };

// Placeholder (optional catch-all so detail links like /services/<id> resolve) — replaced in Phase 5.
export default async function Page() {
  await requirePagePermission("services:view");
  return <ComingSoon title="Services" description="Service catalogue and AED rate cards." phase={5} />;
}
