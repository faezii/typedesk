"use client";


import { useT } from "@/components/i18n";
import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { DeadlineText, PriorityBadge, WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { toDateTimeInput } from "@/lib/dates";
import { moveTask } from "@/server/actions/tasks";
import type { TaskDetail } from "@/server/queries/tasks";
import { TaskDialog } from "./task-dialog";
import { TASK_COLUMNS } from "./task-board";

/** Task detail, opened by the `?task=` URL param so it can be linked and survives refresh. */
export function TaskSheet({ task, users, canEdit }: { task: TaskDetail; users: { id: string; name: string }[]; canEdit: boolean }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const wo = task.workOrder;

  function close() {
    const sp = new URLSearchParams(params);
    sp.delete("task");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="pe-6">{task.title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <DeadlineText deadline={task.deadline} done={task.status === "DONE"} />
            <span>· {task.assignedTo?.name ?? t("Unassigned")}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={task.status}
                disabled={pending}
                onValueChange={(to) =>
                  startTransition(async () => {
                    const res = await moveTask(task.id, to as TaskStatus);
                    if (!res.ok) toast.error(t(res.error));
                    router.refresh();
                  })
                }
              >
                <SelectTrigger className="w-40" aria-label={t("Status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_COLUMNS.map((c) => (
                    <SelectItem key={c.status} value={c.status}>
                      {t(c.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TaskDialog
                users={users}
                taskId={task.id}
                defaultWorkOrder={wo ? { id: wo.id, orderNo: wo.orderNo, subtitle: wo.customer.name } : undefined}
                defaultValues={{
                  title: task.title,
                  description: task.description ?? "",
                  priority: task.priority,
                  deadline: toDateTimeInput(task.deadline),
                  assignedToId: task.assignedToId ?? "",
                  workOrderId: task.workOrderId ?? "",
                }}
              >
                <Button variant="outline">
                  <Pencil /> {t("Edit")}</Button>
              </TaskDialog>
            </div>
          )}

          <section>
            <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">{t("Description")}</h3>
            <p className="text-sm whitespace-pre-wrap">{task.description || <span className="text-muted-foreground">{t("No description.")}</span>}</p>
            {task.completedAt && <p className="text-muted-foreground mt-2 text-xs">{t("Completed {date}", { date: formatDateTime(task.completedAt, t.lang) })}</p>}
          </section>

          {wo ? (
            <>
              <section className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/work-orders/${wo.id}`} className="inline-flex items-center gap-1 font-mono text-sm font-medium hover:underline">
                      {wo.orderNo} <ExternalLink className="size-3" />
                    </Link>
                    <div className="text-muted-foreground truncate text-xs">
                      <Link href={`/customers/${wo.customer.id}`} className="hover:underline">
                        {wo.customer.name}
                      </Link>{" "}
                      · {wo.service.title}
                    </div>
                  </div>
                  <WorkOrderStatusBadge status={wo.status} revision={wo.hasOpenRevision} />
                </div>
              </section>

              <section>
                <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">{t("Client notes")}</h3>
                {wo.notes || wo.customer.notes ? (
                  <div className="space-y-1 text-sm">
                    {wo.notes && <p className="whitespace-pre-wrap">{wo.notes}</p>}
                    {wo.customer.notes && <p className="text-muted-foreground">{t("Customer: {notes}", { notes: wo.customer.notes })}</p>}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t("No notes on this order.")}</p>
                )}
              </section>

              <section>
                <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">{t("Revision history")}</h3>
                {wo.revisions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("No revisions.")}</p>
                ) : (
                  <ul className="space-y-2">
                    {wo.revisions.map((r) => (
                      <li key={r.id} className="rounded-lg border p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <ToneBadge tone={r.resolvedAt ? "green" : "red"}>{r.resolvedAt ? t("Resolved") : t("Open")}</ToneBadge>
                          <span className="text-muted-foreground text-xs">{formatDateTime(r.requestedAt, t.lang)}</span>
                        </div>
                        <p className="mt-1.5">{r.reason}</p>
                        {r.resolution && <p className="text-muted-foreground mt-1 text-xs">{t("Fix: {resolution}", { resolution: r.resolution })}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{t("Not linked to a work order.")}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
