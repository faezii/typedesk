import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Documents" };

// Placeholder (optional catch-all so detail links like /documents/<id> resolve) — replaced in Phase 4.
export default async function Page() {
  await requirePagePermission("documents:view");
  return <ComingSoon title="Documents" description="Passports, Emirates IDs, licenses and files." phase={4} />;
}
