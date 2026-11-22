import { getT } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { VerifyForm } from "./verify-form";

export async function generateMetadata() {
  return { title: (await getT())("Confirm your email") };
}

/** The emailed link lands here; confirming takes a click, so link scanners that open the URL don't use it up. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <VerifyForm token={token ?? ""} />
    </AuthShell>
  );
}
