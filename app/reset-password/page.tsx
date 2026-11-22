import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { ResetForm } from "./reset-form";

export async function generateMetadata() {
  return { title: (await getT())("Choose a new password") };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getT();
  const { token } = await searchParams;
  return (
    <AuthShell>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Choose a new password")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("This reset link is invalid or has expired. Request a new one.")}</p>
          <Link href="/forgot-password" className="text-primary mt-6 inline-block text-sm font-medium hover:underline">
            {t("Request a new link")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
