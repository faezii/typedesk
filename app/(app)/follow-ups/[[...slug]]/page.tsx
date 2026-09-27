import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Follow-ups" };

// Placeholder (optional catch-all so detail links like /follow-ups/<id> resolve) — replaced in Phase 6.
export default async function Page() {
  await requirePagePermission("followUps:view");
  return <ComingSoon title="Follow-ups" description="Passport, visa, license and payment reminders." phase={6} />;
}
