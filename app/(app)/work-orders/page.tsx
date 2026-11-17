import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { ClipboardList, Columns3, Plus, Table2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { DateParam, FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { DeadlineText, PriorityBadge, WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KanbanBoard } from "@/components/work-orders/kanban-board";
import { WorkOrderSheet } from "@/components/work-orders/work-order-sheet";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney, formatDate } from "@/lib/format";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { WORK_ORDER_FLOW } from "@/lib/work-orders";
import { WO_PAGE_SIZE, boardWorkOrders, listWorkOrders, workOrderFormOptions, type WorkOrderListParams } from "@/server/queries/work-orders";

export async function generateMetadata() {
  return { title: (await getT())("Work Orders") };
}

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<WorkOrderListParams> }) {
  const t = await getT();
  const user = await requirePagePermission("workOrders:view");
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "board";
  const canEdit = can(user.role, "workOrders:edit");
  const options = await workOrderFormOptions();
  const now = new Date();

  const viewHref = (v: string) => {
    const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "view" && e[0] !== "page"));
    if (v === "table") sp.set("view", "table");
    else sp.delete("status"); // the board shows every stage
    return `?${sp}`;
  };

  return (
    <>
      <PageHeader
        title={t("Work Orders")}
        description={t("Every job from counter to delivery. Drag cards between stages on the board.")}
        actions={
          canEdit && (
            <WorkOrderSheet options={options}>
              <Button>
                <Plus /> {t("New work order")}</Button>
            </WorkOrderSheet>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="bg-muted inline-flex w-fit rounded-lg p-[3px]" role="group" aria-label={t("View")}>
          {[
            { v: "board", label: t("Board"), Icon: Columns3 },
            { v: "table", label: t("Table"), Icon: Table2 },
          ].map(({ v, label, Icon }) => (
            <Link
              key={v}
              href={viewHref(v)}
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
        <SearchInput placeholder={t("Order no, customer, notes…")} />
        {view === "table" && (
          <FilterSelect
            param="status"
            label={t("Status")}
            allLabel={t("All statuses")}
            options={[...WORK_ORDER_FLOW.map((s) => ({ value: s, label: t(WORK_ORDER_STATUS_LABEL[s]) })), { value: "REVISION", label: t("Open revisions") }]}
          />
        )}
        <FilterSelect
          param="priority"
          label={t("Priority")}
          allLabel={t("Any priority")}
          options={[
            { value: "URGENT", label: t("Urgent") },
            { value: "HIGH", label: t("High") },
            { value: "NORMAL", label: t("Normal") },
          ]}
        />
        <FilterSelect
          param="assignee"
          label={t("Assignee")}
          allLabel={t("Anyone")}
          options={[...(canEdit ? [{ value: user.id, label: t("Assigned to me") }] : []), { value: "none", label: t("Unassigned") }, ...options.users.filter((u) => u.id !== user.id).map((u) => ({ value: u.id, label: u.name }))]}
        />
        <DateParam param="from" label={t("Received from")} />
        <DateParam param="to" label={t("to")} />
      </div>

      {view === "board" ? (
        <KanbanBoard cards={await boardWorkOrders(params)} canEdit={canEdit} now={now.toISOString()} />
      ) : (
        <WorkOrderTable params={params} now={now} />
      )}
    </>
  );
}

async function WorkOrderTable({ params, now }: { params: WorkOrderListParams; now: Date }) {
  const t = await getT();
  const { rows, total, page } = await listWorkOrders(params);
  return (
    <>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
            <ClipboardList className="size-6" />
            {t("No work orders match these filters.")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Order")}</TableHead>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead>{t("Service")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Deadline")}</TableHead>
                <TableHead>{t("Assigned")}</TableHead>
                <TableHead className="pe-4 text-end">{t("Amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id} className="relative">
                  <TableCell className="ps-4">
                    <Link href={`/work-orders/${w.id}`} className="font-mono text-[13px] font-medium after:absolute after:inset-0 hover:underline">
                      {w.orderNo}
                    </Link>
                    <div className="text-muted-foreground text-xs">{formatDate(w.createdAt, t.lang)}</div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{w.customer.name}</TableCell>
                  <TableCell className="max-w-56">
                    <div className="truncate">{w.service.title}</div>
                    {w.translation && (
                      <div className="text-muted-foreground text-xs">
                        {t("{from} → {to}", { from: t(w.translation.sourceLang), to: t(w.translation.targetLang) })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <WorkOrderStatusBadge status={w.status} revision={w.hasOpenRevision} />
                      <PriorityBadge priority={w.priority} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <DeadlineText deadline={w.deadline} done={w.status === "DELIVERED"} now={now} />
                  </TableCell>
                  <TableCell className="text-sm">{w.assignedTo?.name ?? <span className="text-muted-foreground">{t("Unassigned")}</span>}</TableCell>
                  <TableCell className="pe-4 text-end tabular-nums">{formatMoney(w.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={WO_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}
