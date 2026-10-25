"use client";

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
        return void toast.error(res.error);
      }
      toast.success(`Payment of QAR ${amount} recorded`);
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
          <Wallet /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment — {invoiceNo}</DialogTitle>
          <DialogDescription>Balance due: QAR {balance}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (QAR)</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? "pay-error" : undefined} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full" aria-label="Payment method">
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
              <Label htmlFor="pay-ref">Reference</Label>
              <Input id="pay-ref" placeholder={method === "CASH" ? "Optional" : "POS / transfer ref"} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          {error && (
            <p id="pay-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelInvoiceButton({ id, invoiceNo }: { id: string; invoiceNo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="text-destructive"
      onClick={() =>
        confirm(`Cancel ${invoiceNo}? It stays on record as cancelled and its work orders can be invoiced again.`) &&
        startTransition(async () => {
          const res = await cancelInvoice(id);
          if (!res.ok) toast.error(res.error);
          else toast.success(`${invoiceNo} cancelled`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Ban />} Cancel invoice
    </Button>
  );
}

export function RemovePaymentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Remove payment ${label}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        confirm(`Remove the payment of ${label}? Use this only for a payment recorded by mistake. The balance goes back up and the details stay in the activity log.`) &&
        startTransition(async () => {
          const res = await deletePayment(id);
          if (!res.ok) toast.error(res.error);
          else toast.success("Payment removed");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function QuotationStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          const res = await setQuotationStatus(id, v as "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED");
          if (!res.ok) toast.error(res.error);
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-36" aria-label="Quotation status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DRAFT">Draft</SelectItem>
        <SelectItem value="SENT">Sent</SelectItem>
        <SelectItem value="ACCEPTED">Accepted</SelectItem>
        <SelectItem value="REJECTED">Rejected</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ConvertQuotationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await convertQuotation(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Invoice created from quotation");
          router.push(`/finance/invoices/${res.data.invoiceId}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <FileOutput />} Convert to invoice
    </Button>
  );
}
