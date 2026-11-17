import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { BadgeCheck, CalendarClock, FileText, Languages, Type } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { DeadlineText, PriorityBadge, WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { getTranslationOverview } from "@/server/queries/translation";

export async function generateMetadata() {
  return { title: (await getT())("Translation") };
}

const STAGES = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY"] as const;

export default async function TranslationPage() {
  const t = await getT();
  await requirePagePermission("translation:view");
  const { counters, stages, pairs, active } = await getTranslationOverview();
  const now = new Date();
  const maxPair = Math.max(1, ...pairs.map((p) => p.orders));

  return (
    <>
      <PageHeader title={t("Translation")} description={t("Translation orders in progress — pages, words, language pairs and deadlines.")} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Total translations")} value={counters.total.toLocaleString("en-QA")} sub={t("All translation orders")} icon={Languages} />
        <StatCard label={t("Active pages")} value={counters.activePages.toLocaleString("en-QA")} sub={t("Across {activeOrders} open orders", { activeOrders: counters.activeOrders })} icon={FileText} />
        <StatCard label={t("Words this month")} value={counters.wordsThisMonth.toLocaleString("en-QA")} sub={t("Orders received this month")} icon={Type} />
        <StatCard label={t("Due this week")} value={counters.dueThisWeek} sub={t("Not delivered, due within 7 days (incl. overdue)")} icon={CalendarClock} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <section className="bg-card rounded-xl border p-5 lg:col-span-2">
          <h2 className="font-medium">{t("Pipeline")}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("Open translation orders by stage")}</p>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s} className="bg-muted/40 rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  {i + 1}. {t(WORK_ORDER_STATUS_LABEL[s])}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{stages[s] ?? 0}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">{t("Language pairs")}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("All-time orders, top 8")}</p>
          {pairs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("No translations yet.")}</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {pairs.map((p) => (
                <li key={p.pair} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{t("{from} → {to}", { from: t(p.from), to: t(p.to) })}</span>
                    <span className="text-muted-foreground tabular-nums">{t("{orders} · {value} pp", { orders: p.orders, value: p.pages.toLocaleString("en-QA") })}</span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 rounded-full" aria-hidden>
                    <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(p.orders / maxPair) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-card rounded-xl border">
        <header className="px-5 pt-4 pb-2">
          <h2 className="font-medium">{t("Active translations")}</h2>
          <p className="text-muted-foreground text-xs">{t("Not yet delivered or under revision, soonest deadline first")}</p>
        </header>
        {active.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("No translations in progress.")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("Order")}</TableHead>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead>{t("Languages")}</TableHead>
                <TableHead className="text-end">{t("Pages")}</TableHead>
                <TableHead className="text-end">{t("Words")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Translator")}</TableHead>
                <TableHead className="pe-5">{t("Deadline")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((w) => (
                <TableRow key={w.id} className="relative">
                  <TableCell className="ps-5">
                    <Link href={`/work-orders/${w.id}`} className="font-mono text-[13px] font-medium after:absolute after:inset-0 hover:underline">
                      {w.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-44 truncate">{w.customer.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t("{from} → {to}", { from: t(w.translation!.sourceLang), to: t(w.translation!.targetLang) })}
                    {w.translation!.isCertified && <BadgeCheck className="text-primary ms-1 inline size-3.5" aria-label={t("Certified")} />}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{w.translation!.pageCount}</TableCell>
                  <TableCell className="text-end tabular-nums">{w.translation!.wordCount.toLocaleString("en-QA")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <WorkOrderStatusBadge status={w.status} revision={w.hasOpenRevision} />
                      <PriorityBadge priority={w.priority} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{w.assignedTo?.name ?? <span className="text-muted-foreground">{t("Unassigned")}</span>}</TableCell>
                  <TableCell className="pe-5">
                    <DeadlineText deadline={w.deadline} done={w.status === "DELIVERED"} now={now} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
