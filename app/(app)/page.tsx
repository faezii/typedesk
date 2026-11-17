import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton, Panel } from "@/components/dashboard/panel";
import { DueWorkOrders, FollowUps, Kpis, RecentPayments, Revenue, Status } from "@/components/dashboard/sections";
import { StatCardSkeleton } from "@/components/dashboard/stat-card";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatLocal, greetingFor } from "@/lib/dates";

export async function generateMetadata() {
  return { title: (await getT())("Dashboard") };
}

export default async function DashboardPage() {
  const t = await getT();
  const user = await requirePagePermission("dashboard:view");
  const finance = can(user.role, "finance:view");
  const now = new Date();
  const viewer = { id: user.id, role: user.role };

  const statusPanel = (
    <Panel title={t("Work status")} description={t("Open pipeline and deliveries in the last 30 days")} href="/work-orders">
      <Suspense fallback={<Skeleton className="h-44 w-full" />}>
        <Status user={viewer} />
      </Suspense>
    </Panel>
  );
  const duePanel = (
    <Panel title={t("Due today & overdue")} href="/work-orders">
      <Suspense fallback={<ListSkeleton />}>
        <DueWorkOrders user={viewer} />
      </Suspense>
    </Panel>
  );
  const followUpPanel = (
    <Panel title={t("Upcoming follow-ups")} description={t("Due in the next 7 days")} href="/follow-ups">
      <Suspense fallback={<ListSkeleton />}>
        <FollowUps user={viewer} />
      </Suspense>
    </Panel>
  );

  return (
    <div className="space-y-4">
      <section className="from-primary/10 via-primary/5 rounded-xl border bg-gradient-to-r to-transparent px-5 py-5 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("{greeting}, {name}", { greeting: t(greetingFor(now)), name: user.name.split(" ")[0] })}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("{date} · Doha", { date: formatLocal(now, "EEEE, d MMMM yyyy", t.lang) })}</p>
      </section>

      <div className={finance ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" : "grid gap-4 sm:grid-cols-3"}>
        <Suspense fallback={Array.from({ length: finance ? 5 : 3 }, (_, i) => <StatCardSkeleton key={i} />)}>
          <Kpis user={viewer} />
        </Suspense>
      </div>

      {finance ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title={t("Revenue")}
              description={t("Invoiced vs collected, last 6 months (QAR, incl. VAT)")}
              href="/finance/payments"
              className="xl:col-span-2"
            >
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <Revenue />
              </Suspense>
            </Panel>
            {statusPanel}
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {duePanel}
            {followUpPanel}
            <Panel title={t("Recent payments")} href="/finance/payments">
              <Suspense fallback={<ListSkeleton />}>
                <RecentPayments />
              </Suspense>
            </Panel>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {statusPanel}
          {duePanel}
          {followUpPanel}
        </div>
      )}
    </div>
  );
}
