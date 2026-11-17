import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { BellRing, ClipboardCheck, ReceiptText } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { LanguageButton } from "@/components/i18n";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: (await getT())("Sign in") };
}

const HIGHLIGHTS = [
  { icon: ClipboardCheck, title: "Every job, every stage", text: "Work orders, translations and revisions tracked from counter to delivery." },
  { icon: ReceiptText, title: "Invoicing in QAR", text: "Invoices and quotations, payments and collections, with VAT ready when Qatar introduces it." },
  { icon: BellRing, title: "Nothing slips", text: "Follow-ups for passport, QID, visa and license expiries." },
];

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
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside className="bg-sidebar text-sidebar-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -end-40 size-[520px] rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10 rounded-xl" />
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">{t("TypeDesk")}</div>
            <div className="text-sidebar-foreground/60 text-xs">{t("Translation & Typing Center")}</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">
            {t("Run the whole center from one desk.")}</h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3.5">
                <div className="bg-sidebar-accent text-sidebar-primary grid size-9 shrink-0 place-items-center rounded-lg">
                  <h.icon className="size-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{t(h.title)}</div>
                  <div className="text-sidebar-foreground/65 mt-0.5 text-sm">{t(h.text)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sidebar-foreground/45 relative text-xs">{t("Doha · Qatar")}</div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <LanguageButton className="absolute end-4 top-4" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-9 rounded-xl" />
            <div className="text-lg font-semibold tracking-tight">{t("TypeDesk")}</div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Sign in")}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{t("Use your staff email and password.")}</p>

          <LoginForm callbackUrl={next} />

          {showDemo && (
            <div className="bg-muted/50 text-muted-foreground mt-8 rounded-lg border border-dashed p-3.5 text-xs">
              <div className="text-foreground mb-1.5 font-medium">{t("Development logins")}</div>
              <div className="font-mono leading-relaxed">
                {t("admin@ · manager@ · finance@ · typist@ · translator@typedesk.qa")}</div>
              <div className="mt-1">
                {t("Password:")}{" "}<span className="font-mono">{t("Password123!")}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
