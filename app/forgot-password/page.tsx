import { getT } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata() {
  return { title: (await getT())("Forgot password") };
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotForm />
    </AuthShell>
  );
}
