import { AlertTriangle, Clock, RotateCcw } from "lucide-react";
import type { Priority, WorkOrderStatus } from "@prisma/client";
import { PRIORITY_LABEL, WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { formatLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deadlineInfo } from "@/lib/work-orders";
import { ToneBadge, type Tone } from "./tone-badge";

const STATUS_TONE: Record<WorkOrderStatus, Tone> = {
  RECEIVED: "gray",
  IN_PROGRESS: "blue",
  QUALITY_CHECK: "violet",
  READY: "amber",
  DELIVERED: "green",
};

export function WorkOrderStatusBadge({ status, revision = false }: { status: WorkOrderStatus; revision?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <ToneBadge tone={STATUS_TONE[status]}>{WORK_ORDER_STATUS_LABEL[status]}</ToneBadge>
      {revision && <RevisionBadge />}
    </span>
  );
}

export function RevisionBadge() {
  return (
    <ToneBadge tone="red">
      <RotateCcw className="size-3" aria-hidden /> Revision
    </ToneBadge>
  );
}

/** Only High / Urgent get a badge; Normal stays quiet. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "NORMAL") return null;
  return <ToneBadge tone={priority === "URGENT" ? "red" : "amber"}>{PRIORITY_LABEL[priority]}</ToneBadge>;
}

/** Deadline with overdue (red) / today (amber) highlighting. Pass `now` from the server to keep SSR and client in sync. */
export function DeadlineText({ deadline, done = false, now, className }: { deadline: Date | null; done?: boolean; now?: Date; className?: string }) {
  if (!deadline) return <span className={cn("text-muted-foreground text-xs", className)}>No deadline</span>;
  // Once delivered, "overdue" no longer means anything — just show when it was due.
  if (done) return <span className={cn("text-muted-foreground text-xs whitespace-nowrap", className)}>Due {formatLocal(deadline, "d MMM")}</span>;
  const { label, tone } = deadlineInfo(deadline, now);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        tone === "overdue" && "text-destructive font-medium",
        tone === "today" && "font-medium text-amber-700 dark:text-amber-400",
        (tone === "soon" || tone === "later") && "text-muted-foreground",
        className,
      )}
    >
      {tone === "overdue" ? <AlertTriangle className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}
      {label}
    </span>
  );
}
