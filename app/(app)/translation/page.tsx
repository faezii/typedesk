import Link from "next/link";
import { BadgeCheck, CalendarClock, FileText, Languages, Type } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { DeadlineText, PriorityBadge, WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { getTranslationOverview } from "@/server/queries/translation";

export const metadata = { title: "Translation" };

const STAGES = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY"] as const;

export default async function TranslationPage() {
  await requirePagePermission("translation:view");
  const { counters, stages, pairs, active } = await getTranslationOverview();
  const now = new Date();
  const maxPair = Math.max(1, ...pairs.map((p) => p.orders));

  return (
    <>
      <PageHeader title="Translation" description="Translation orders in progress — pages, words, language pairs and deadlines." />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total translations" value={counters.total.toLocaleString("en-QA")} sub="All translation orders" icon={Languages} />
        <StatCard label="Active pages" value={counters.activePages.toLocaleString("en-QA")} sub={`Across ${counters.activeOrders} open orders`} icon={FileText} />
        <StatCard label="Words this month" value={counters.wordsThisMonth.toLocaleString("en-QA")} sub="Orders received this month" icon={Type} />
        <StatCard label="Due this week" value={counters.dueThisWeek} sub="Not delivered, due within 7 days (incl. overdue)" icon={CalendarClock} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <section className="bg-card rounded-xl border p-5 lg:col-span-2">
          <h2 className="font-medium">Pipeline</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">Open translation orders by stage</p>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s} className="bg-muted/40 rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  {i + 1}. {WORK_ORDER_STATUS_LABEL[s]}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{stages[s] ?? 0}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-card rounded-xl border p-5">
          <h2 className="font-medium">Language pairs</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">All-time orders, top 8</p>
          {pairs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No translations yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {pairs.map((p) => (
                <li key={p.pair} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{p.pair}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {p.orders} · {p.pages.toLocaleString("en-QA")} pp
                    </span>
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
          <h2 className="font-medium">Active translations</h2>
          <p className="text-muted-foreground text-xs">Not yet delivered or under revision, soonest deadline first</p>
        </header>
        {active.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">No translations in progress.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead className="text-right">Words</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Translator</TableHead>
                <TableHead className="pr-5">Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((w) => (
                <TableRow key={w.id} className="relative">
                  <TableCell className="pl-5">
                    <Link href={`/work-orders/${w.id}`} className="font-mono text-[13px] font-medium after:absolute after:inset-0 hover:underline">
                      {w.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-44 truncate">{w.customer.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {w.translation!.sourceLang} → {w.translation!.targetLang}
                    {w.translation!.isCertified && <BadgeCheck className="text-primary ml-1 inline size-3.5" aria-label="Certified" />}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{w.translation!.pageCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.translation!.wordCount.toLocaleString("en-QA")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <WorkOrderStatusBadge status={w.status} revision={w.hasOpenRevision} />
                      <PriorityBadge priority={w.priority} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{w.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell className="pr-5">
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
