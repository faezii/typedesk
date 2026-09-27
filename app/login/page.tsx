import { redirect } from "next/navigation";
import { BellRing, ClipboardCheck, ReceiptText } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: ClipboardCheck, title: "Every job, every stage", text: "Work orders, translations and revisions tracked from counter to delivery." },
  { icon: ReceiptText, title: "UAE tax invoicing", text: "AED invoices and quotations with 5% VAT, payments and collections." },
  { icon: BellRing, title: "Nothing slips", text: "Follow-ups for passport, Emirates ID, visa and license expiries." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
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
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10 rounded-xl" />
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">TypeDesk</div>
            <div className="text-sidebar-foreground/60 text-xs">Translation &amp; Typing Center</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">
            Run the whole center from one desk.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3.5">
                <div className="bg-sidebar-accent text-sidebar-primary grid size-9 shrink-0 place-items-center rounded-lg">
                  <h.icon className="size-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{h.title}</div>
                  <div className="text-sidebar-foreground/65 mt-0.5 text-sm">{h.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sidebar-foreground/45 relative text-xs">Dubai · United Arab Emirates</div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-9 rounded-xl" />
            <div className="text-lg font-semibold tracking-tight">TypeDesk</div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Use your staff email and password.</p>

          <LoginForm callbackUrl={next} />

          {showDemo && (
            <div className="bg-muted/50 text-muted-foreground mt-8 rounded-lg border border-dashed p-3.5 text-xs">
              <div className="text-foreground mb-1.5 font-medium">Development logins</div>
              <div className="font-mono leading-relaxed">
                admin@ · manager@ · finance@ · typist@ · translator@typedesk.ae
              </div>
              <div className="mt-1">
                Password: <span className="font-mono">Password123!</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
