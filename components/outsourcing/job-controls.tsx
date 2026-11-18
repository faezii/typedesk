"use client";


import { useT } from "@/components/i18n";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import type { QaStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setPaymentStatus, setQaStatus, setVendorActive, uploadDelivery } from "@/server/actions/outsourcing";

function useRun() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(t(res.error));
      else toast.success(t(success));
      router.refresh();
    });
  return { pending, run };
}

export function QaSelect({ id, status }: { id: string; status: QaStatus }) {
  const t = useT();
  const { pending, run } = useRun();
  return (
    <Select value={status} disabled={pending} onValueChange={(v) => run(() => setQaStatus(id, v as QaStatus), `QA ${v.toLowerCase()}`)}>
      <SelectTrigger size="sm" className="w-32" aria-label={t("QA status")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PENDING">{t("Pending")}</SelectItem>
        <SelectItem value="APPROVED">{t("Approved")}</SelectItem>
        <SelectItem value="REJECTED">{t("Rejected")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function PaymentButton({ id, paid, amount, vendor }: { id: string; paid: boolean; amount: string; vendor: string }) {
  const t = useT();
  const { pending, run } = useRun();
  if (paid) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={t("Reverse payment to {vendor}", { vendor })}
        onClick={() => confirm(t("Mark as unpaid? The QAR {amount} freelancer expense will be removed.", { amount })) && run(() => setPaymentStatus(id, false), "Payment reversed")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} {t("Undo")}</Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => confirm(t("Mark QAR {amount} to {vendor} as paid? A Freelancer expense is booked automatically.", { amount, vendor })) && run(() => setPaymentStatus(id, true), "Paid — expense booked")}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Banknote />} {t("Mark paid")}</Button>
  );
}

export function DeliveryUpload({ id }: { id: string }) {
  const t = useT();
  const { pending, run } = useRun();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 4 * 1024 * 1024) return void toast.error(t("Files must be 4 MB or smaller."));
          const fd = new FormData();
          fd.set("file", file);
          run(() => uploadDelivery(id, fd), "Delivery uploaded");
        }}
      />
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => input.current?.click()} aria-label={t("Upload the vendor's delivered file")}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} {t("Delivery")}</Button>
    </>
  );
}

export function VendorActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const t = useT();
  const { pending, run } = useRun();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={active} disabled={pending} aria-label={t("{name} active", { name })} onCheckedChange={(v) => run(() => setVendorActive(id, v === true), v ? "Vendor activated" : "Vendor deactivated")} />
      <span className={active ? "" : "text-muted-foreground"}>{active ? t("Active") : t("Inactive")}</span>
    </label>
  );
}
