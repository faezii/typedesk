import { getLang, getT } from "@/lib/i18n/server";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Clock, FileClock, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { formatLocal } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABEL, PAYMENT_METHOD_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import {
  getDueWorkOrders,
  getKpis,
  getRecentPayments,
  getRevenueSeries,
  getStatusBreakdown,
  getUpcomingFollowUps,
} from "@/server/queries/dashboard";
import { syncPaymentReminders } from "@/server/services/payment-reminders";
import { EmptyList } from "./panel";
import { RevenueChart } from "./revenue-chart";
import { StatCard } from "./stat-card";
import { StatusDonut } from "./status-donut";

type Viewer = Pick<CurrentUser, "id" | "role">;

export async function Kpis({ user }: { user: Viewer }) {
  const t = await getT();
  const k = await getKpis(user);
  const mine = !can(user.role, "dashboard:viewAll");
  const change = k.revenue?.changePct;

  return (
    <>
      <StatCard label={t("Total customers")} value={k.customers.toLocaleString("en-QA")} icon={Users} href="/customers" />
      <StatCard
        label={mine ? t("My active orders") : t("Active work orders")}
        value={k.active}
        sub={t("Not yet delivered or under revision")}
        icon={ClipboardList}
        href="/work-orders"
      />
      <StatCard
        label={t("Today's work")}
        value={k.dueToday}
        sub={
          k.overdue > 0 ? (
            <span className="text-destructive inline-flex items-center gap-1">
              <AlertTriangle className="size-3" /> {t("{count} overdue", { count: k.overdue })}
            </span>
          ) : (
            t("Due today · none overdue")
          )
        }
        icon={Clock}
        href="/work-orders"
      />
      {k.pendingInvoicing && (
        <StatCard
          label={t("Pending invoicing")}
          value={formatMoney(k.pendingInvoicing.amount)}
          sub={k.pendingInvoicing.count === 1 ? t("1 delivered order not invoiced (excl. VAT)") : t("{count} delivered orders not invoiced (excl. VAT)", { count: k.pendingInvoicing.count })}
          icon={FileClock}
          href="/finance/invoices"
        />
      )}
      {k.revenue && (
        <StatCard
          label={t("Revenue this month")}
          value={formatMoney(k.revenue.amount)}
          sub={
            change == null ? (
              t("Collected · no payments last month to compare")
            ) : (
              <span>
                <span className={change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                </span>{" "}
                {t("vs same period last month")}
              </span>
            )
          }
          icon={Wallet}
          href="/finance/payments"
        />
      )}
    </>
  );
}

export async function Revenue() {
  return <RevenueChart data={await getRevenueSeries(await getLang())} />;
}

export async function Status({ user }: { user: Viewer }) {
  return <StatusDonut data={await getStatusBreakdown(user)} />;
}

export async function DueWorkOrders({ user }: { user: Viewer }) {
  const t = await getT();
  const { items, total, startToday } = await getDueWorkOrders(user);
  if (items.length === 0) return <EmptyList>{t("Nothing due today or overdue.")}</EmptyList>;

  return (
    <>
      <ul className="divide-y">
        {items.map((wo) => {
          const overdue = wo.deadline! < startToday;
          return (
            <li key={wo.id}>
              <Link href={`/work-orders/${wo.id}`} className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-medium whitespace-nowrap">{wo.orderNo}</span>
                    {wo.priority !== "NORMAL" && (
                      <Badge variant={wo.priority === "URGENT" ? "destructive" : "secondary"}>{t(PRIORITY_LABEL[wo.priority])}</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {wo.customer.name} · {wo.service.title}
                  </div>
                </div>
                <div className="shrink-0 text-end text-xs">
                  {overdue ? (
                    <span className="text-destructive inline-flex items-center gap-1 font-medium">
                      <AlertTriangle className="size-3" /> {t("Overdue")}</span>
                  ) : (
                    <span className="font-medium">{t("Today")}</span>
                  )}
                  <div className="text-muted-foreground">
                    {overdue ? formatDate(wo.deadline, t.lang) : formatLocal(wo.deadline!, "h:mm a", t.lang)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {total > items.length && <p className="text-muted-foreground mt-2 text-xs">{t("+{value} more", { value: total - items.length })}</p>}
    </>
  );
}

export async function FollowUps({ user }: { user: Viewer }) {
  const t = await getT();
  await syncPaymentReminders();
  const { items, overdue } = await getUpcomingFollowUps(user);
  const todayKey = formatLocal(new Date(), "yyyy-MM-dd", t.lang);

  return (
    <>
      {overdue > 0 && (
        <Link href="/follow-ups" className="text-destructive mb-1 inline-flex items-center gap-1 text-xs font-medium hover:underline">
          <AlertTriangle className="size-3" /> {overdue === 1 ? t("1 overdue follow-up") : t("{count} overdue follow-ups", { count: overdue })}
        </Link>
      )}
      {items.length === 0 ? (
        <EmptyList>{t("Nothing due in the next 7 days.")}</EmptyList>
      ) : (
        <ul className="divide-y">
          {items.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.title}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {t(FOLLOW_UP_TYPE_LABEL[f.type])}
                  {f.customer && ` · ${f.customer.name}`}
                </div>
              </div>
              <div className="text-muted-foreground shrink-0 text-xs">
                {formatLocal(f.deadline, "yyyy-MM-dd", t.lang) === todayKey ? t("Today") : formatLocal(f.deadline, "EEE d MMM", t.lang)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export async function RecentPayments() {
  const t = await getT();
  const items = await getRecentPayments();
  if (items.length === 0) return <EmptyList>{t("No payments recorded yet.")}</EmptyList>;

  return (
    <ul className="divide-y">
      {items.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.customer.name}</div>
            <div className="text-muted-foreground truncate text-xs">
              <span className="font-mono">{p.invoice.invoiceNo}</span> · {t(PAYMENT_METHOD_LABEL[p.method])}
            </div>
          </div>
          <div className="shrink-0 text-end">
            <div className="text-sm font-medium tabular-nums">{formatMoney(p.amount)}</div>
            <div className="text-muted-foreground text-xs">{formatDate(p.date, t.lang)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
