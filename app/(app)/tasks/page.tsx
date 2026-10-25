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

export const metadata = { title: "Tasks" };

const STATUS_TONE = { TODO: "gray", IN_PROGRESS: "blue", DONE: "green" } as const;
const STATUS_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" } as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskListParams> }) {
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
        title="Tasks"
        description={assignee === user.id ? "Your tasks. Switch the assignee filter to see the whole team." : "Staff tasks and allocations."}
        actions={
          canEdit && (
            <TaskDialog users={users} defaultValues={{ title: "", description: "", priority: "NORMAL", deadline: "", assignedToId: user.id, workOrderId: "" }}>
              <Button>
                <Plus /> New task
              </Button>
            </TaskDialog>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="bg-muted inline-flex w-fit rounded-lg p-[3px]" role="group" aria-label="View">
          {[
            { v: "board", label: "Board", Icon: Columns3 },
            { v: "table", label: "Table", Icon: Table2 },
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
        <SearchInput placeholder="Task, WO number, customer…" />
        <AssigneeFilter users={users} userId={user.id} defaultValue={can(user.role, "tasks:viewAll") ? "everyone" : user.id} />
        <FilterSelect
          param="priority"
          label="Priority"
          allLabel="Any priority"
          options={[
            { value: "URGENT", label: "Urgent" },
            { value: "HIGH", label: "High" },
            { value: "NORMAL", label: "Normal" },
          ]}
        />
        <FilterSelect
          param="due"
          label="Due"
          allLabel="Any due date"
          options={[
            { value: "overdue", label: "Overdue" },
            { value: "today", label: "Due today" },
            { value: "week", label: "Due within 7 days" },
            { value: "none", label: "No deadline" },
          ]}
        />
        {view === "table" && (
          <FilterSelect
            param="status"
            label="Status"
            allLabel="All statuses"
            options={[
              { value: "TODO", label: "To do" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "DONE", label: "Done" },
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
function AssigneeFilter({ users, userId, defaultValue }: { users: { id: string; name: string }[]; userId: string; defaultValue: string }) {
  return (
    <FilterSelect
      param="assignee"
      label="Assignee"
      defaultValue={defaultValue}
      options={[
        { value: "everyone", label: "Everyone" },
        { value: userId, label: "Assigned to me" },
        { value: "none", label: "Unassigned" },
        ...users.filter((u) => u.id !== userId).map((u) => ({ value: u.id, label: u.name })),
      ]}
    />
  );
}

async function TaskTable({ params, user, now }: { params: TaskListParams; user: { id: string; role: Parameters<typeof listTasks>[1]["role"] }; now: Date }) {
  const { rows, total, page } = await listTasks(params, user);
  const href = (id: string) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter((e): e is [string, string] => !!e[1])), task: id })}`;
  return (
    <>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
            <ListTodo className="size-6" />
            No tasks match these filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Task</TableHead>
                <TableHead>Work order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="pr-4">Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell className="max-w-96 pl-4">
                    <Link href={href(t.id)} scroll={false} className="font-medium after:absolute after:inset-0 hover:underline">
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.workOrder ? (
                      <>
                        <span className="font-mono">{t.workOrder.orderNo}</span>
                        <div className="text-muted-foreground">{t.workOrder.customer.name}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ToneBadge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</ToneBadge>
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <DeadlineText deadline={t.deadline} done={t.status === "DONE"} now={now} />
                  </TableCell>
                  <TableCell className="pr-4 text-sm">{t.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
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
