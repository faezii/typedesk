"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_CATEGORY_LABEL, EXPIRING_CATEGORIES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CustomerPicker, type CustomerOption } from "@/components/customers/customer-picker";
import { findCustomerWorkOrders, uploadDocument } from "@/server/actions/documents";
import type { DocumentCategory } from "@prisma/client";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx";
const OK_EXT = /\.(pdf|jpe?g|png|docx)$/i;

export function UploadDialog({
  defaultCustomer,
  defaultWorkOrderId,
  children,
}: {
  defaultCustomer?: { id: string; name: string };
  /** Preselect a work order (requires defaultCustomer). */
  defaultWorkOrderId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [customer, setCustomer] = useState<CustomerOption | null>(defaultCustomer ?? null);
  const [workOrders, setWorkOrders] = useState<{ id: string; label: string }[]>([]);
  const [workOrderId, setWorkOrderId] = useState(defaultWorkOrderId ?? "none");
  const [expiryDate, setExpiryDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the selected customer's recent work orders for linking.
  useEffect(() => {
    let cancelled = false;
    (customer ? findCustomerWorkOrders(customer.id) : Promise.resolve([])).then((rows) => {
      if (!cancelled) setWorkOrders(rows.map((w) => ({ id: w.id, label: `${w.orderNo} · ${w.service.title}` })));
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  function reset() {
    setFile(null);
    setFileError(null);
    setName("");
    setCategory("");
    setCustomer(defaultCustomer ?? null);
    setWorkOrderId(defaultWorkOrderId ?? "none");
    setExpiryDate("");
  }

  function pick(f: File | undefined) {
    if (!f) return;
    if (!OK_EXT.test(f.name)) return setFileError("Only PDF, JPG, PNG and DOCX files are allowed.");
    if (f.size > MAX_BYTES) return setFileError("Files must be 10 MB or smaller.");
    setFileError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  const showExpiry = category !== "" && EXPIRING_CATEGORIES.includes(category);
  const canSubmit = !!file && !!category && name.trim().length > 0 && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !category) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", name);
    fd.set("category", category);
    if (customer) fd.set("customerId", customer.id);
    if (workOrderId !== "none") fd.set("workOrderId", workOrderId);
    if (showExpiry && expiryDate) fd.set("expiryDate", expiryDate);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Document uploaded");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>PDF, JPG, PNG or DOCX, up to 10 MB.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Drop zone — the hidden input keeps it keyboard and screen-reader accessible. */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
              "focus-within:ring-ring/50 focus-within:ring-3",
              dragging ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              fileError && "border-destructive",
            )}
          >
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            {file ? (
              <div className="flex w-full items-center gap-3 text-left">
                <FileUp className="text-primary size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{file.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <>
                <FileUp className="text-muted-foreground size-6" />
                <span>
                  <span className="text-primary font-medium">Choose a file</span> or drag it here
                </span>
              </>
            )}
          </label>
          {fileError && (
            <p className="text-destructive -mt-2 text-sm" role="alert">
              {fileError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="doc-name">Document name</Label>
              <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger className="w-full" aria-label="Category">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_CATEGORY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showExpiry && (
              <div className="space-y-2">
                <Label htmlFor="doc-expiry">Expiry date</Label>
                <Input id="doc-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            )}
            {!defaultCustomer && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer</Label>
                <CustomerPicker value={customer} onChange={(c) => (setCustomer(c), setWorkOrderId("none"))} />
              </div>
            )}
            {customer && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Work order</Label>
                <Select value={workOrderId} onValueChange={setWorkOrderId}>
                  <SelectTrigger className="w-full" aria-label="Work order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked to a work order</SelectItem>
                    {workOrders.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {showExpiry && customer && (category === "PASSPORT" || category === "NATIONAL_ID") && expiryDate && (
            <p className="text-muted-foreground text-xs">
              This becomes {customer.name}&apos;s current {DOCUMENT_CATEGORY_LABEL[category]} expiry, and its renewal follow-up is updated.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending && <Loader2 className="animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
