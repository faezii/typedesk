"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { WorkOrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { WORK_ORDER_FLOW } from "@/lib/work-orders";
import { moveWorkOrder, requestRevision, resolveRevision } from "@/server/actions/work-orders";

/** Stage menu — the non-drag way to move an order (also keyboard-friendly). */
export function StatusSelect({ id, status, locked }: { id: string; status: WorkOrderStatus; locked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending || locked}
      onValueChange={(to) =>
        startTransition(async () => {
          const res = await moveWorkOrder(id, status, to as WorkOrderStatus);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Moved to ${WORK_ORDER_STATUS_LABEL[to as WorkOrderStatus]}`);
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-48" aria-label="Stage" title={locked ? "Resolve the open revision to change the stage" : undefined}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORK_ORDER_FLOW.map((s) => (
          <SelectItem key={s} value={s}>
            {WORK_ORDER_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Request revision" on delivered orders; "Resolve revision" while one is open. */
export function RevisionButton({ id, open }: { id: string; open: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = open ? await resolveRevision(id, text) : await requestRevision(id, text);
      if (!res.ok) return void toast.error(res.error);
      toast.success(open ? "Revision resolved" : "Revision requested");
      setShow(false);
      setText("");
      router.refresh();
    });
  }

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogTrigger asChild>
        <Button variant={open ? "default" : "outline"}>
          {open ? <CheckCircle2 /> : <RotateCcw />}
          {open ? "Resolve revision" : "Request revision"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{open ? "Resolve revision" : "Request a revision"}</DialogTitle>
          <DialogDescription>
            {open
              ? "Describe what was corrected. The order stays Delivered and the revision is closed."
              : "The order stays Delivered and is flagged for correction. Its history is kept."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="revision-text">{open ? "What was corrected" : "What needs correcting"}</Label>
          <Textarea
            id="revision-text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={open ? "e.g. Name corrected to match passport; re-stamped and delivered" : "e.g. Client's name spelt differently from passport on page 2"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || text.trim().length < 3}>
            {pending && <Loader2 className="animate-spin" />}
            {open ? "Resolve" : "Request revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
