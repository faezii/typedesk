import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return { title: (await getT())("Not found") };
}

/** notFound() inside the app (deleted customer, wrong invoice id, …) — rendered inside the sidebar shell. */
export default async function NotFound({ className }: { className?: string }) {
  const t = await getT();
  return (
    <StatusPage
      icon={FileQuestion}
      title={t("We couldn't find that")}
      className={className}
      actions={
        <Button asChild>
          <Link href="/">{t("Back to dashboard")}</Link>
        </Button>
      }
    >
      {t("The page or record doesn't exist, or it has been deleted. Check the link and try again.")}</StatusPage>
  );
}
