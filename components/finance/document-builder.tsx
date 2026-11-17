"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { CustomerPicker, type CustomerOption } from "@/components/customers/customer-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { documentSchema, type DocumentFormValues } from "@/lib/validation/finance";
import { findBillableWorkOrders, saveInvoice, saveQuotation } from "@/server/actions/invoices";

type Billable = Awaited<ReturnType<typeof findBillableWorkOrders>>[number];
const EMPTY_LINE = { description: "", serviceId: "", workOrderId: "", quantity: "1", unitPrice: "" };
const fmt = (n: number) => n.toLocaleString("en-QA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DocumentBuilder({
  kind,
  docId,
  defaultValues,
  defaultCustomer,
  services,
  vatRate,
}: {
  kind: "invoice" | "quotation";
  docId?: string;
  defaultValues: DocumentFormValues;
  defaultCustomer?: CustomerOption;
  services: { id: string; title: string; defaultPrice: string }[];
  /** Display only — the server recomputes every total. */
  vatRate: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(defaultCustomer ?? null);
  const [billable, setBillable] = useState<Billable[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const form = useForm<DocumentFormValues, unknown, z.output<typeof documentSchema>>({ resolver: zodResolver(documentSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" });

  const lineTotals = items.map((l) => Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) / 100 || 0);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const vat = Math.round(subtotal * Number(vatRate) * 100) / 100;
  const isInvoice = kind === "invoice";

  async function openImport() {
    if (!customer) return void toast.error(t("Choose the customer first."));
    const rows = await findBillableWorkOrders(customer.id);
    const already = new Set(items.map((i) => i.workOrderId).filter(Boolean));
    setBillable(rows.filter((r) => !already.has(r.id)));
    setPicked(new Set());
  }

  function importPicked() {
    const rows = billable!.filter((b) => picked.has(b.id));
    // Replace a single untouched empty line rather than leaving it dangling.
    if (items.length === 1 && !items[0]!.description && !items[0]!.unitPrice) remove(0);
    append(rows.map((r) => ({ description: r.description, serviceId: r.serviceId, workOrderId: r.id, quantity: r.quantity, unitPrice: r.unitPrice })));
    setBillable(null);
  }

  function onSubmit() {
    startTransition(async () => {
      const values = form.getValues();
      const res = isInvoice ? await saveInvoice(docId ?? null, values) : await saveQuotation(docId ?? null, values);
      if (!res.ok) {
        for (const [f, m] of Object.entries(res.fieldErrors ?? {})) form.setError(f as never, { message: m });
        return void toast.error(t(res.error));
      }
      toast.success(docId ? t("Saved") : isInvoice ? t("Invoice issued") : t("Quotation created"));
      router.push(isInvoice ? `/finance/invoices/${res.data.id}` : `/finance/invoices/quotes/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <section className="bg-card grid gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="customerId"
            render={({ fieldState }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t("Customer")}</FormLabel>
                <CustomerPicker
                  value={customer}
                  allowClear={false}
                  invalid={!!fieldState.error}
                  onChange={(c) => {
                    setCustomer(c);
                    form.setValue("customerId", c?.id ?? "", { shouldValidate: true });
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {(["issueDate", "dueDate"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{name === "issueDate" ? (isInvoice ? t("Invoice date") : t("Quote date")) : isInvoice ? t("Due date") : t("Valid until")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </section>

        <section className="bg-card rounded-xl border">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <h2 className="font-medium">{t("Line items")}</h2>
            <div className="flex gap-2">
              {isInvoice && (
                <Button type="button" size="sm" variant="outline" onClick={openImport}>
                  <ClipboardList /> {t("Import work orders")}</Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => append({ ...EMPTY_LINE })}>
                <Plus /> {t("Add line")}</Button>
            </div>
          </header>

          <div className="overflow-x-auto">
            <div className="min-w-[760px] divide-y">
              <div className="text-muted-foreground grid grid-cols-[180px_1fr_80px_110px_110px_36px] gap-2 px-5 py-2 text-xs font-medium">
                <span>{t("Service")}</span>
                <span>{t("Description")}</span>
                <span className="text-end">{t("Qty")}</span>
                <span className="text-end">{t("Rate (QAR)")}</span>
                <span className="text-end">{t("Amount")}</span>
                <span />
              </div>
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[180px_1fr_80px_110px_110px_36px] items-start gap-2 px-5 py-2">
                  <Select
                    value={items[i]?.serviceId || "custom"}
                    onValueChange={(v) => {
                      const svc = services.find((s) => s.id === v);
                      form.setValue(`items.${i}.serviceId`, svc?.id ?? "");
                      if (svc) {
                        if (!items[i]?.description) form.setValue(`items.${i}.description`, svc.title);
                        form.setValue(`items.${i}.unitPrice`, svc.defaultPrice, { shouldValidate: true });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full min-w-0" aria-label={t("Line {n} service", { n: i + 1 })}>
                      <span className="min-w-0 flex-1 truncate text-start">
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t("Custom item")}</SelectItem>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormField
                    control={form.control}
                    name={`items.${i}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input aria-label={t("Line {n} description", { n: i + 1 })} {...field} />
                        </FormControl>
                        {items[i]?.workOrderId && <p className="text-muted-foreground text-[11px]">{t("Linked to a work order")}</p>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(["quantity", "unitPrice"] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={`items.${i}.${name}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input inputMode="decimal" className="text-end" aria-label={name === "quantity" ? t("Line {n} quantity", { n: i + 1 }) : t("Line {n} rate", { n: i + 1 })} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <div className="flex h-8 items-center justify-end text-sm tabular-nums">{fmt(lineTotals[i] ?? 0)}</div>
                  <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5" aria-label={t("Remove line {n}", { n: i + 1 })} disabled={fields.length === 1} onClick={() => remove(i)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {form.formState.errors.items?.root?.message || form.formState.errors.items?.message ? (
            <p className="text-destructive px-5 pb-3 text-sm">{form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message}</p>
          ) : null}

          <div className="flex flex-col gap-4 border-t px-5 py-4 lg:flex-row lg:justify-between">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="lg:w-1/2">
                  <FormLabel>{isInvoice ? t("Notes (printed on the invoice)") : t("Notes (printed on the quotation)")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <dl className="w-full space-y-1.5 text-sm lg:w-72">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("Subtotal")}</dt>
                <dd className="tabular-nums">{t("QAR {value}", { value: fmt(subtotal) })}</dd>
              </div>
              {Number(vatRate) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("VAT ({value}%)", { value: Math.round(Number(vatRate) * 10000) / 100 })}</dt>
                  <dd className="tabular-nums">{t("QAR {value}", { value: fmt(vat) })}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                <dt>{t("Total")}</dt>
                <dd className="tabular-nums">{t("QAR {value}", { value: fmt(subtotal + vat) })}</dd>
              </div>
              <p className="text-muted-foreground text-xs">{t("Final totals are calculated on save.")}</p>
            </dl>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("Cancel")}</Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {docId ? t("Save changes") : isInvoice ? t("Issue invoice") : t("Create quotation")}
          </Button>
        </div>
      </form>

      <Dialog open={billable !== null} onOpenChange={(o) => !o && setBillable(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Import delivered work orders")}</DialogTitle>
            <DialogDescription>{t("Delivered orders for {name} that haven't been invoiced yet.", { name: customer?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          {billable?.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("Nothing left to invoice for this customer.")}</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {billable?.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-start gap-3 py-2.5 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={picked.has(b.id)}
                      onCheckedChange={(v) => setPicked((p) => (v ? new Set(p).add(b.id) : new Set([...p].filter((x) => x !== b.id))))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{b.description}</span>
                      <span className="text-muted-foreground text-xs">{t("{quantity} × QAR {unitPrice}", { quantity: b.quantity, unitPrice: b.unitPrice })}</span>
                    </span>
                    <span className="tabular-nums">{t("QAR {totalAmount}", { totalAmount: b.totalAmount })}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillable(null)}>
              {t("Cancel")}</Button>
            <Button onClick={importPicked} disabled={picked.size === 0}>{picked.size === 1 ? t("Add 1 line") : picked.size ? t("Add {count} lines", { count: picked.size }) : t("Add lines")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
