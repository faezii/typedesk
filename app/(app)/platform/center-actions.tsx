"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OrgStatus } from "@prisma/client";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { extendTrial, setCenterStatus } from "@/server/actions/platform";

export function CenterActions({ id, status, own }: { id: string; status: OrgStatus; own: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(t(done));
      else toast.error(t(res.error));
      router.refresh();
    });

  return (
    <div className="flex justify-end gap-1.5 whitespace-nowrap">
      {status !== "ACTIVE" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => extendTrial(id), "Trial extended by 30 days")}>
          {t("+30 days")}
        </Button>
      )}
      {status !== "ACTIVE" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => setCenterStatus(id, "ACTIVE"), "Center activated")}>
          {t("Activate")}
        </Button>
      )}
      {status !== "SUSPENDED" && !own && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => confirm(t("Suspend this center? Its staff can't sign in until you activate it again.")) && run(() => setCenterStatus(id, "SUSPENDED"), "Center suspended")}
        >
          {t("Suspend")}
        </Button>
      )}
    </div>
  );
}
