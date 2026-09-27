import { cookies } from "next/headers";
import { AppShell, SIDEBAR_COOKIE } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, department: user.department }}
      defaultCollapsed={collapsed}
    >
      {children}
    </AppShell>
  );
}
