import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: (await getT())("Sign in") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const t = await getT();
  const [user, { callbackUrl }] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/");

  // callbackUrl may be absolute (Auth.js adds the origin). Keep only path + query so it can never
  // point off-site; the login action re-validates it too.
  let next = "/";
  if (callbackUrl) {
    try {
      const u = new URL(callbackUrl, "http://local");
      next = `${u.pathname}${u.search}`;
    } catch {
      /* ignore malformed */
    }
  }

  const showDemo = process.env.NODE_ENV !== "production";

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Sign in")}</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{t("Use your staff email and password.")}</p>

      <LoginForm callbackUrl={next} />

      {showDemo && (
        <div className="bg-muted/50 text-muted-foreground mt-8 rounded-lg border border-dashed p-3.5 text-xs">
          <div className="text-foreground mb-1.5 font-medium">{t("Development logins")}</div>
          <div className="font-mono leading-relaxed">
            <span dir="ltr">admin@ · manager@ · finance@ · typist@ · translator@typedesk.qa</span></div>
          <div className="mt-1">
            {t("Password:")}{" "}<span className="font-mono" dir="ltr">Password123!</span>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
