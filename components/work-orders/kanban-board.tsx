"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { WorkOrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { DeadlineText, PriorityBadge, RevisionBadge } from "@/components/shared/work-order-badges";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { WORK_ORDER_FLOW } from "@/lib/work-orders";
import { moveWorkOrder } from "@/server/actions/work-orders";
import type { BoardCard } from "@/server/queries/work-orders";

export function KanbanBoard({ cards: initial, canEdit, now }: { cards: BoardCard[]; canEdit: boolean; now: string }) {
  const t = useT();
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const nowDate = new Date(now);

  // New server data (filters changed, refresh after a move) replaces local state.
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setCards(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // lets clicks on links through
    useSensor(KeyboardSensor),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const card = cards.find((c) => c.id === active.id);
    const to = over?.id as WorkOrderStatus | undefined;
    if (!card || !to || card.status === to) return;
    if (card.hasOpenRevision) {
      toast.error(t("This order has an open revision. Resolve it first — it stays Delivered while being corrected."));
      return;
    }
    const from = card.status;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: to } : c))); // optimistic
    startTransition(async () => {
      const res = await moveWorkOrder(card.id, from, to);
      if (!res.ok) {
        setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: from } : c)));
        toast.error(t(res.error));
      } else {
        toast.success(`${card.orderNo} → ${t(WORK_ORDER_STATUS_LABEL[to])}`);
      }
      router.refresh();
    });
  }

  const active = cards.find((c) => c.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => t("Picked up {orderNo}.", { orderNo: cards.find((c) => c.id === active.id)?.orderNo ?? "" }),
          onDragOver: ({ over }) => (over ? t("Over {status}.", { status: t(WORK_ORDER_STATUS_LABEL[over.id as WorkOrderStatus]) }) : t("Not over a column.")),
          onDragEnd: ({ active, over }) =>
            over ? t("Moved {orderNo} to {status}.", { orderNo: cards.find((c) => c.id === active.id)?.orderNo ?? "", status: t(WORK_ORDER_STATUS_LABEL[over.id as WorkOrderStatus]) }) : t("Move cancelled."),
          onDragCancel: () => t("Move cancelled."),
        },
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {WORK_ORDER_FLOW.map((status) => {
            const column = cards.filter((c) => c.status === status);
            return (
              <Column key={status} status={status} count={column.length}>
                {column.map((c) => (
                  <DraggableCard key={c.id} card={c} disabled={!canEdit} now={nowDate} />
                ))}
              </Column>
            );
          })}
        </div>
      </div>
      <DragOverlay>{active && <CardBody card={active} now={nowDate} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, count, children }: { status: WorkOrderStatus; count: number; children: React.ReactNode }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={t("{label}, {count} orders", { label: t(WORK_ORDER_STATUS_LABEL[status]), count })}
      className={cn("bg-muted/40 flex min-h-[60vh] flex-col rounded-xl border p-2 transition-colors", isOver && "border-primary bg-primary/5")}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2">
        <h2 className="text-sm font-medium">{t(WORK_ORDER_STATUS_LABEL[status])}</h2>
        <span className="text-muted-foreground bg-background rounded-full border px-2 text-xs tabular-nums">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {children}
        {count === 0 && <p className="text-muted-foreground px-2 py-6 text-center text-xs">{t("No orders")}</p>}
      </div>
      {status === "DELIVERED" && <p className="text-muted-foreground px-2 pt-2 text-[11px]">{t("Last 14 days and open revisions. Older orders are in the table view.")}</p>}
    </section>
  );
}

function DraggableCard({ card, disabled, now }: { card: BoardCard; disabled: boolean; now: Date }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription={t("Draggable work order")}
      aria-label={t("{orderNo}, {name}. Press space to pick up and move with arrow keys.", { orderNo: card.orderNo, name: card.customer.name })}
      className={cn("rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50", !disabled && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <CardBody card={card} now={now} />
    </div>
  );
}

function CardBody({ card, now, dragging = false }: { card: BoardCard; now: Date; dragging?: boolean }) {
  const t = useT();
  return (
    <article className={cn("bg-card space-y-2 rounded-lg border p-3 text-sm shadow-xs", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/work-orders/${card.id}`} className="font-mono text-[13px] font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          {card.orderNo}
        </Link>
        <PriorityBadge priority={card.priority} />
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{card.customer.name}</div>
        <div className="text-muted-foreground truncate text-xs">
          {card.service.title}
          {card.translation && ` · ${t("{from} → {to}", { from: t(card.translation.sourceLang), to: t(card.translation.targetLang) })}`}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DeadlineText deadline={card.deadline} done={card.status === "DELIVERED"} now={now} />
        <span className="text-muted-foreground truncate text-xs">{card.assignedTo?.name.split(" ")[0] ?? t("Unassigned")}</span>
      </div>
      {card.hasOpenRevision && <RevisionBadge />}
    </article>
  );
}
