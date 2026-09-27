import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Tasks" };

// Placeholder (optional catch-all so detail links like /tasks/<id> resolve) — replaced in Phase 6.
export default async function Page() {
  await requirePagePermission("tasks:view");
  return <ComingSoon title="Tasks" description="Staff task board and allocations." phase={6} />;
}
