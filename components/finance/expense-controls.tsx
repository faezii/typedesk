"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { deleteExpense, saveExpense } from "@/server/actions/expenses";

export type ExpenseDefaults = { category: string; amount: string; vatAmount: string; description: string; date: string; vendorId: string };

export function ExpenseDialog({
  expenseId,
  defaults,
  vendors,
  hasReceipt = false,
  children,
}: {
  expenseId?: string;
  defaults: ExpenseDefaults;
  vendors: { id: string; name: string }[];
  hasReceipt?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(defaults.category);
  const [vendorId, setVendorId] = useState(defaults.vendorId || "none");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("category", category);
    fd.set("vendorId", vendorId === "none" ? "" : vendorId);
    const receipt = fd.get("receipt");
    if (receipt instanceof File && receipt.size > 10 * 1024 * 1024) return setErrors({ receipt: "Files must be 10 MB or smaller." });
    startTransition(async () => {
      const res = await saveExpense(expenseId ?? null, fd);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(expenseId ? "Expense updated" : "Expense recorded");
      setOpen(false);
      router.refresh();
    });
  }

  const err = (name: string) =>
    errors[name] ? (
      <p id={`exp-${name}-error`} className="text-destructive text-sm">
        {errors[name]}
      </p>
    ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setErrors({});
          setCategory(defaults.category);
          setVendorId(defaults.vendorId || "none");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expenseId ? "Edit expense" : "Record expense"}</DialogTitle>
          <DialogDescription>Enter the amount before VAT; recoverable VAT goes in its own field for the VAT report.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Date</Label>
              <Input id="exp-date" name="date" type="date" defaultValue={defaults.date} required aria-invalid={!!errors.date || undefined} />
              {err("date")}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="exp-description">Description</Label>
              <Input id="exp-description" name="description" defaultValue={defaults.description} placeholder="e.g. DEWA electricity — October" required aria-invalid={!!errors.description || undefined} />
              {err("description")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Amount excl. VAT (AED)</Label>
              <Input id="exp-amount" name="amount" inputMode="decimal" defaultValue={defaults.amount} required aria-invalid={!!errors.amount || undefined} />
              {err("amount")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-vat">VAT (AED)</Label>
              <Input id="exp-vat" name="vatAmount" inputMode="decimal" defaultValue={defaults.vatAmount} placeholder="0.00" aria-invalid={!!errors.vatAmount || undefined} />
              {err("vatAmount")}
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="w-full" aria-label="Vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-receipt">Receipt {hasReceipt && <span className="text-muted-foreground font-normal">(replaces current)</span>}</Label>
              <Input id="exp-receipt" name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-xs" />
              {err("receipt")}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {expenseId ? "Save" : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteExpenseButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Delete expense ${label}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        confirm(`Delete "${label}"? This can't be undone (a copy is kept in the audit log).`) &&
        startTransition(async () => {
          const res = await deleteExpense(id);
          if (!res.ok) toast.error(res.error);
          else toast.success("Expense deleted");
          router.refresh();
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
