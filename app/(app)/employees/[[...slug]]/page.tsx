import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Employees" };

// Placeholder (optional catch-all so detail links like /employees/<id> resolve) — replaced in Phase 6.
export default async function Page() {
  await requirePagePermission("employees:view");
  return <ComingSoon title="Employees" description="Staff directory, roles and workload." phase={6} />;
}
