import { cookies } from "next/headers";
import { differenceInCalendarDays } from "date-fns";
import { AppShell, SIDEBAR_COOKIE } from "@/components/layout/app-shell";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // requireUser sends a center whose trial ended (or that was suspended) to /blocked.
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const org = user.organization;
  const trialDaysLeft = org.status === "TRIAL" && org.trialEndsAt ? Math.max(0, differenceInCalendarDays(org.trialEndsAt, new Date())) : null;

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, department: user.department, center: org.name, platformAdmin: isPlatformAdmin(user.email) }}
      defaultCollapsed={collapsed}
      mustChangePassword={user.mustChangePassword}
      trialDaysLeft={trialDaysLeft}
    >
      {children}
    </AppShell>
  );
}
