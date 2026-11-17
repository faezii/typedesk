"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { TaskStatus } from "@prisma/client";
import { toast } from "sonner";
import { DeadlineText, PriorityBadge } from "@/components/shared/work-order-badges";
import { cn } from "@/lib/utils";
import { moveTask } from "@/server/actions/tasks";
import type { TaskCard } from "@/server/queries/tasks";

export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

export function TaskBoard({ tasks: initial, canEdit, now }: { tasks: TaskCard[]; canEdit: boolean; now: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tasks, setTasks] = useState(initial);
  const [synced, setSynced] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const nowDate = new Date(now);
  if (initial !== synced) {
    setSynced(initial);
    setTasks(initial);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const detailHref = (id: string) => {
    const sp = new URLSearchParams(params);
    sp.set("task", id);
    return `${pathname}?${sp}`;
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const task = tasks.find((item) => item.id === active.id);
    const to = over?.id as TaskStatus | undefined;
    if (!task || !to || task.status === to) return;
    const from = task.status;
    setTasks((ts) => ts.map((item) => (item.id === task.id ? { ...item, status: to } : item)));
    startTransition(async () => {
      const res = await moveTask(task.id, to);
      if (!res.ok) {
        setTasks((ts) => ts.map((item) => (item.id === task.id ? { ...item, status: from } : item)));
        toast.error(t(res.error));
      }
      router.refresh();
    });
  }

  const active = tasks.find((item) => item.id === activeId);
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-3">
        {TASK_COLUMNS.map(({ status, label }) => {
          const column = tasks.filter((item) => item.status === status);
          return (
            <Column key={status} status={status} label={label} count={column.length}>
              {column.map((item) => (
                <Draggable key={item.id} task={item} disabled={!canEdit} now={nowDate} href={detailHref(item.id)} />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active && <CardBody task={active} now={nowDate} href="#" dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, label, count, children }: { status: TaskStatus; label: string; count: number; children: React.ReactNode }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={t("{label}, {count} tasks", { label: t(label), count })}
      className={cn("bg-muted/40 flex min-h-[50vh] flex-col rounded-xl border p-2 transition-colors", isOver && "border-primary bg-primary/5")}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2">
        <h2 className="text-sm font-medium">{t(label)}</h2>
        <span className="text-muted-foreground bg-background rounded-full border px-2 text-xs tabular-nums">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {children}
        {count === 0 && <p className="text-muted-foreground px-2 py-6 text-center text-xs">{t("No tasks")}</p>}
      </div>
      {status === "DONE" && <p className="text-muted-foreground px-2 pt-2 text-[11px]">{t("Completed in the last 14 days. Older tasks are in the table view.")}</p>}
    </section>
  );
}

function Draggable({ task, disabled, now, href }: { task: TaskCard; disabled: boolean; now: Date; href: string }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription={t("Draggable task")}
      aria-label={t("{title}. Press space to pick up and move with arrow keys.", { title: task.title })}
      className={cn("rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50", !disabled && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <CardBody task={task} now={now} href={href} />
    </div>
  );
}

function CardBody({ task, now, href, dragging = false }: { task: TaskCard; now: Date; href: string; dragging?: boolean }) {
  const t = useT();
  return (
    <article className={cn("bg-card space-y-2 rounded-lg border p-3 text-sm shadow-xs", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={href} scroll={false} className="font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          {task.title}
        </Link>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.workOrder && (
        <div className="text-muted-foreground truncate text-xs">
          <span className="font-mono">{task.workOrder.orderNo}</span> · {task.workOrder.customer.name}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <DeadlineText deadline={task.deadline} done={task.status === "DONE"} now={now} />
        <span className="text-muted-foreground truncate text-xs">{task.assignedTo?.name.split(" ")[0] ?? t("Unassigned")}</span>
      </div>
    </article>
  );
}
