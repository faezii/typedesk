import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Outsourced Work" };

// Placeholder (optional catch-all so detail links like /outsourced/<id> resolve) — replaced in Phase 7.
export default async function Page() {
  await requirePagePermission("outsourced:view");
  return <ComingSoon title="Outsourced Work" description="Freelancer and agency assignments." phase={7} />;
}
