import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return { title: (await getT())("Access denied") };
}

export default async function ForbiddenPage() {
  const t = await getT();
  return (
    <StatusPage
      icon={ShieldX}
      destructive
      title={t("You don't have access to this page")}
      actions={
        <Button asChild>
          <Link href="/">{t("Back to dashboard")}</Link>
        </Button>
      }
    >
      {t("Your role doesn't include this section. Ask an administrator if you need access.")}</StatusPage>
  );
}
