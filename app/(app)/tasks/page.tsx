import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { Columns3, ListTodo, Plus, Table2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ToneBadge } from "@/components/shared/tone-badge";
import { FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { DeadlineText, PriorityBadge } from "@/components/shared/work-order-badges";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { activeUserOptions } from "@/server/queries/employees";
import { TASK_PAGE_SIZE, boardTasks, effectiveAssignee, getTaskDetail, listTasks, type TaskListParams } from "@/server/queries/tasks";

export async function generateMetadata() {
  return { title: (await getT())("Tasks") };
}

const STATUS_TONE = { TODO: "gray", IN_PROGRESS: "blue", DONE: "green" } as const;
const STATUS_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" } as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskListParams> }) {
  const t = await getT();
  const user = await requirePagePermission("tasks:view");
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "board";
  const canEdit = can(user.role, "tasks:edit");
  const [users, detail] = await Promise.all([activeUserOptions(), params.task ? getTaskDetail(params.task) : null]);
  const now = new Date();
  const assignee = effectiveAssignee(params, user);

  const viewHref = (v: string) => {
    const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && !["view", "page", "task", "status"].includes(e[0])));
    if (v === "table") sp.set("view", "table");
    return `?${sp}`;
  };

  return (
    <>
      <PageHeader
        title={t("Tasks")}
        description={assignee === user.id ? t("Your tasks. Switch the assignee filter to see the whole team.") : t("Staff tasks and allocations.")}
        actions={
          canEdit && (
            <TaskDialog users={users} defaultValues={{ title: "", description: "", priority: "NORMAL", deadline: "", assignedToId: user.id, workOrderId: "" }}>
              <Button>
                <Plus /> {t("New task")}</Button>
            </TaskDialog>
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
        <SearchInput placeholder={t("Task, WO number, customer…")} />
        <AssigneeFilter users={users} userId={user.id} defaultValue={can(user.role, "tasks:viewAll") ? "everyone" : user.id} />
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
          param="due"
          label={t("Due")}
          allLabel={t("Any due date")}
          options={[
            { value: "overdue", label: t("Overdue") },
            { value: "today", label: t("Due today") },
            { value: "week", label: t("Due within 7 days") },
            { value: "none", label: t("No deadline") },
          ]}
        />
        {view === "table" && (
          <FilterSelect
            param="status"
            label={t("Status")}
            allLabel={t("All statuses")}
            options={[
              { value: "TODO", label: t("To do") },
              { value: "IN_PROGRESS", label: t("In progress") },
              { value: "DONE", label: t("Done") },
            ]}
          />
        )}
      </div>

      {view === "board" ? (
        <TaskBoard tasks={await boardTasks(params, user)} canEdit={canEdit} now={now.toISOString()} />
      ) : (
        <TaskTable params={params} user={user} now={now} />
      )}

      {detail && <TaskSheet key={detail.id} task={detail} users={users} canEdit={canEdit} />}
    </>
  );
}

/** STAFF default to "Assigned to me", everyone else to "Everyone", so both are explicit options. */
async function AssigneeFilter({ users, userId, defaultValue }: { users: { id: string; name: string }[]; userId: string; defaultValue: string }) {
  const t = await getT();
  return (
    <FilterSelect
      param="assignee"
      label={t("Assignee")}
      defaultValue={defaultValue}
      options={[
        { value: "everyone", label: t("Everyone") },
        { value: userId, label: t("Assigned to me") },
        { value: "none", label: t("Unassigned") },
        ...users.filter((u) => u.id !== userId).map((u) => ({ value: u.id, label: u.name })),
      ]}
    />
  );
}

async function TaskTable({ params, user, now }: { params: TaskListParams; user: { id: string; role: Parameters<typeof listTasks>[1]["role"] }; now: Date }) {
  const t = await getT();
  const { rows, total, page } = await listTasks(params, user);
  const href = (id: string) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter((e): e is [string, string] => !!e[1])), task: id })}`;
  return (
    <>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
            <ListTodo className="size-6" />
            {t("No tasks match these filters.")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Task")}</TableHead>
                <TableHead>{t("Work order")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Deadline")}</TableHead>
                <TableHead className="pe-4">{t("Assignee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((task) => (
                <TableRow key={task.id} className="relative">
                  <TableCell className="max-w-96 ps-4">
                    <Link href={href(task.id)} scroll={false} className="font-medium after:absolute after:inset-0 hover:underline">
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {task.workOrder ? (
                      <>
                        <span className="font-mono">{task.workOrder.orderNo}</span>
                        <div className="text-muted-foreground">{task.workOrder.customer.name}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ToneBadge tone={STATUS_TONE[task.status]}>{t(STATUS_LABEL[task.status])}</ToneBadge>
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <DeadlineText deadline={task.deadline} done={task.status === "DONE"} now={now} />
                  </TableCell>
                  <TableCell className="pe-4 text-sm">{task.assignedTo?.name ?? <span className="text-muted-foreground">{t("Unassigned")}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={TASK_PAGE_SIZE} total={total} params={{ ...params, task: undefined }} />
      </div>
    </>
  );
}
