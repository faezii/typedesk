"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileOutput, Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { cancelInvoice, convertQuotation, deletePayment, recordPayment, setQuotationStatus } from "@/server/actions/invoices";
import type { PaymentMethod } from "@prisma/client";

export function RecordPaymentDialog({ invoiceId, invoiceNo, balance, today }: { invoiceId: string; invoiceNo: string; balance: string; today: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPayment({ invoiceId, amount, method, reference, date });
      if (!res.ok) {
        setError(res.fieldErrors?.amount ?? res.error);
        return void toast.error(t(res.error));
      }
      toast.success(t("Payment of QAR {amount} recorded", { amount }));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(balance);
          setReference("");
          setDate(today);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Wallet /> {t("Record payment")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Record payment — {invoiceNo}", { invoiceNo })}</DialogTitle>
          <DialogDescription>{t("Balance due: QAR {balance}", { balance })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">{t("Amount (QAR)")}</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? "pay-error" : undefined} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">{t("Date")}</Label>
              <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full" aria-label={t("Payment method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">{t("Reference")}</Label>
              <Input id="pay-ref" placeholder={method === "CASH" ? t("Optional") : t("POS / transfer ref")} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          {error && (
            <p id="pay-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("Cancel")}</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("Record payment")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelInvoiceButton({ id, invoiceNo }: { id: string; invoiceNo: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="text-destructive"
      onClick={() =>
        confirm(t("Cancel {invoiceNo}? It stays on record as cancelled and its work orders can be invoiced again.", { invoiceNo })) &&
        startTransition(async () => {
          const res = await cancelInvoice(id);
          if (!res.ok) toast.error(t(res.error));
          else toast.success(t("{invoiceNo} cancelled", { invoiceNo }));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Ban />} {t("Cancel invoice")}</Button>
  );
}

export function RemovePaymentButton({ id, label }: { id: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={t("Remove payment {label}", { label })}
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        confirm(t("Remove the payment of {label}? Use this only for a payment recorded by mistake. The balance goes back up and the details stay in the activity log.", { label })) &&
        startTransition(async () => {
          const res = await deletePayment(id);
          if (!res.ok) toast.error(t(res.error));
          else toast.success(t("Payment removed"));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function QuotationStatusSelect({ id, status }: { id: string; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          const res = await setQuotationStatus(id, v as "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED");
          if (!res.ok) toast.error(t(res.error));
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-36" aria-label={t("Quotation status")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DRAFT">{t("Draft")}</SelectItem>
        <SelectItem value="SENT">{t("Sent")}</SelectItem>
        <SelectItem value="ACCEPTED">{t("Accepted")}</SelectItem>
        <SelectItem value="REJECTED">{t("Rejected")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ConvertQuotationButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await convertQuotation(id);
          if (!res.ok) return void toast.error(t(res.error));
          toast.success(t("Invoice created from quotation"));
          router.push(`/finance/invoices/${res.data.invoiceId}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <FileOutput />} {t("Convert to invoice")}</Button>
  );
}
