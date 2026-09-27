import { ComingSoon } from "@/components/shared/coming-soon";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata = { title: "Translation" };

// Placeholder (optional catch-all so detail links like /translation/<id> resolve) — replaced in Phase 5.
export default async function Page() {
  await requirePagePermission("translation:view");
  return <ComingSoon title="Translation" description="Pages, words and language pairs in progress." phase={5} />;
}
