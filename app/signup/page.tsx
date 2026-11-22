import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { turnstileSiteKey } from "@/lib/turnstile";
import { SignUpForm } from "./signup-form";

export async function generateMetadata() {
  return { title: (await getT())("Start your free trial") };
}

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell>
      <SignUpForm turnstileSiteKey={turnstileSiteKey()} />
    </AuthShell>
  );
}
