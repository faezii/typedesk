import Link from "next/link";
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, List, Pencil, Plus } from "lucide-react";
import { FollowUpDialog, FollowUpQuickActions } from "@/components/follow-ups/follow-up-controls";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { FilterSelect } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatLocal, toDateInput } from "@/lib/dates";
import { FOLLOW_UP_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { activeUserOptions } from "@/server/queries/employees";
import { followUpCalendar, listFollowUps, type FollowUpItem, type FollowUpParams } from "@/server/queries/follow-ups";
import { syncPaymentReminders } from "@/server/services/payment-reminders";
import type { FollowUpType } from "@prisma/client";

export const metadata = { title: "Follow-ups" };

const TYPE_TONE: Record<FollowUpType, Tone> = {
  PASSPORT_EXPIRY: "violet",
  NATIONAL_ID_EXPIRY: "blue",
  VISA_DEADLINE: "blue",
  TRADE_LICENSE_RENEWAL: "amber",
  PAYMENT_REMINDER: "red",
  GENERAL: "gray",
};
const GROUP_STYLE: Record<string, string> = { overdue: "text-destructive", today: "text-amber-700 dark:text-amber-400", week: "", later: "text-muted-foreground" };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<FollowUpParams> }) {
  const user = await requirePagePermission("followUps:view");
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";
  const canEdit = can(user.role, "followUps:edit");
  await syncPaymentReminders();
  const users = await activeUserOptions();

  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(Object.entries({ ...params, ...patch }).filter((e): e is [string, string] => !!e[1]));
    return `?${sp}`;
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Passport, QID, visa and license deadlines, payment reminders and client call-backs."
        actions={
          canEdit && (
            <FollowUpDialog users={users} defaultValues={{ title: "", type: "GENERAL", deadline: toDateInput(new Date()), customerId: "", assignedToId: user.id, notes: "" }}>
              <Button>
                <Plus /> New follow-up
              </Button>
            </FollowUpDialog>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="bg-muted inline-flex w-fit rounded-lg p-[3px]" role="group" aria-label="View">
          {[
            { v: "list", label: "List", Icon: List },
            { v: "calendar", label: "Calendar", Icon: CalendarDays },
          ].map(({ v, label, Icon }) => (
            <Link
              key={v}
              href={href({ view: v === "list" ? undefined : v, status: undefined })}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </div>
        <FilterSelect param="type" label="Type" allLabel="All types" options={Object.entries(FOLLOW_UP_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect
          param="assignee"
          label="Assigned to"
          allLabel="Anyone"
          options={[{ value: user.id, label: "Assigned to me" }, { value: "none", label: "Unassigned" }, ...users.filter((u) => u.id !== user.id).map((u) => ({ value: u.id, label: u.name }))]}
        />
        {view === "list" && (
          <FilterSelect param="status" label="Status" allLabel="Open" options={[{ value: "done", label: "Done (recent)" }]} />
        )}
      </div>

      {view === "calendar" ? <Calendar params={params} href={href} /> : <GroupedList params={params} canEdit={canEdit} users={users} />}
    </>
  );
}

async function GroupedList({ params, canEdit, users }: { params: FollowUpParams; canEdit: boolean; users: { id: string; name: string }[] }) {
  const { groups, done } = await listFollowUps(params);
  if (params.status === "done") {
    return (
      <section className="bg-card rounded-xl border px-5 py-2">
        {done.length === 0 ? <Empty>Nothing completed yet.</Empty> : <ul className="divide-y">{done.map((f) => <Row key={f.id} f={f} canEdit={canEdit} users={users} done />)}</ul>}
      </section>
    );
  }
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  if (total === 0) return <Empty>No open follow-ups.</Empty>;

  return (
    <div className="space-y-4">
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.key} className="bg-card rounded-xl border">
            <header className="flex items-center justify-between border-b px-5 py-3">
              <h2 className={cn("font-medium", GROUP_STYLE[g.key])}>{g.label}</h2>
              <span className="text-muted-foreground text-xs tabular-nums">{g.items.length}</span>
            </header>
            <ul className="divide-y px-5">
              {g.items.map((f) => (
                <Row key={f.id} f={f} canEdit={canEdit} users={users} />
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

function Row({ f, canEdit, users, done = false }: { f: FollowUpItem; canEdit: boolean; users: { id: string; name: string }[]; done?: boolean }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="text-muted-foreground w-20 shrink-0 text-xs tabular-nums">{formatLocal(f.deadline, "EEE d MMM")}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{f.title}</span>
          <ToneBadge tone={TYPE_TONE[f.type]}>{FOLLOW_UP_TYPE_LABEL[f.type]}</ToneBadge>
          {f.status === "SNOOZED" && <ToneBadge tone="gray">Snoozed</ToneBadge>}
          {f.autoKey && <span className="text-muted-foreground text-[11px]">auto</span>}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-xs">
          {f.customer ? (
            <Link href={`/customers/${f.customer.id}`} className="hover:text-foreground underline-offset-2 hover:underline">
              {f.customer.name}
            </Link>
          ) : (
            "No customer"
          )}
          {f.notes && ` · ${f.notes}`}
          {` · ${f.assignedTo?.name ?? "Unassigned"}`}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <FollowUpQuickActions id={f.id} done={done} title={f.title} />
          <FollowUpDialog
            users={users}
            followUpId={f.id}
            defaultCustomer={f.customer ?? undefined}
            defaultValues={{ title: f.title, type: f.type, deadline: toDateInput(f.deadline), customerId: f.customer?.id ?? "", assignedToId: f.assignedTo?.id ?? "", notes: f.notes ?? "" }}
          >
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.title}`}>
              <Pencil />
            </Button>
          </FollowUpDialog>
        </div>
      )}
    </li>
  );
}

async function Calendar({ params, href }: { params: FollowUpParams; href: (p: Record<string, string | undefined>) => string }) {
  const cal = await followUpCalendar(params);
  return (
    <section className="bg-card rounded-xl border">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={href({ month: cal.prev })} aria-label="Previous month">
            <ChevronLeft />
          </Link>
        </Button>
        <h2 className="font-medium">{cal.label}</h2>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={href({ month: cal.next })} aria-label="Next month">
            <ChevronRight />
          </Link>
        </Button>
      </header>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-muted-foreground border-b px-2 py-1.5 text-xs font-medium">
              {d}
            </div>
          ))}
          {cal.days.map((d) => (
            <div key={d.key} className={cn("min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !d.inMonth && "bg-muted/30")}>
              <div
                className={cn(
                  "mb-1 grid size-6 place-items-center rounded-full text-xs tabular-nums",
                  d.key === cal.today ? "bg-primary text-primary-foreground font-semibold" : d.inMonth ? "" : "text-muted-foreground",
                )}
              >
                {d.day}
              </div>
              <ul className="space-y-1">
                {d.items.slice(0, 3).map((f) => (
                  <li
                    key={f.id}
                    title={`${f.title} — ${FOLLOW_UP_TYPE_LABEL[f.type]}`}
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]",
                      f.status === "DONE" ? "text-muted-foreground line-through" : d.key < cal.today ? "bg-destructive/10" : "bg-primary/10",
                    )}
                  >
                    {f.status !== "DONE" && (
                      <span className={cn("size-1.5 shrink-0 rounded-full", d.key < cal.today ? "bg-destructive" : "bg-primary")} aria-hidden />
                    )}
                    <span className="truncate">
                      {f.customer ? <Link href={`/customers/${f.customer.id}`} className="hover:underline">{f.title}</Link> : f.title}
                    </span>
                  </li>
                ))}
                {d.items.length > 3 && <li className="text-muted-foreground px-1.5 text-[11px]">+{d.items.length - 3} more</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center text-sm">
      <BellRing className="size-6" />
      {children}
    </div>
  );
}
