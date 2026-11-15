import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Account" description={`${user.name} · ${user.email}`} />
      <section className="bg-card max-w-lg rounded-xl border p-5">
        <h2 className="font-medium">Change password</h2>
        <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
          {user.mustChangePassword ? "You're using a temporary password. Choose your own to continue." : "At least 8 characters with letters and a number."}
        </p>
        <ChangePasswordForm />
      </section>
    </>
  );
}
