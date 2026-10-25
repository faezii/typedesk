"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerPicker, type CustomerOption } from "@/components/customers/customer-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, SERVICE_CATEGORY_LABEL, SERVICE_UNIT_LABEL } from "@/lib/labels";
import { workOrderSchema, type WorkOrderData, type WorkOrderFormValues } from "@/lib/validation/work-order";
import { isTranslation, quantityFromTranslation } from "@/lib/work-orders";
import { saveWorkOrder } from "@/server/actions/work-orders";
import type { WorkOrderFormOptions } from "@/server/queries/work-orders";
import type { ServiceCategory } from "@prisma/client";

const EMPTY: WorkOrderFormValues = {
  customerId: "",
  serviceId: "",
  quantity: "1",
  unitPrice: "",
  priority: "NORMAL",
  deadline: "",
  assignedToId: "",
  notes: "",
  translation: { sourceLang: "Arabic", targetLang: "English", pageCount: "", wordCount: "", isCertified: true },
};

export function WorkOrderSheet({
  options,
  workOrderId,
  defaultValues,
  defaultCustomer,
  children,
}: {
  options: WorkOrderFormOptions;
  /** Omit to create a new order. */
  workOrderId?: string;
  defaultValues?: WorkOrderFormValues;
  defaultCustomer?: CustomerOption;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(defaultCustomer ?? null);
  const initial = () => ({ ...(defaultValues ?? EMPTY), customerId: defaultCustomer?.id ?? defaultValues?.customerId ?? "" });
  const form = useForm<WorkOrderFormValues, unknown, WorkOrderData>({ resolver: zodResolver(workOrderSchema), defaultValues: initial() });

  const [serviceId, quantity, unitPrice] = useWatch({ control: form.control, name: ["serviceId", "quantity", "unitPrice"] });
  const service = options.services.find((s) => s.id === serviceId);
  const translating = !!service && isTranslation(service.category);
  // Display-only estimate; the server recomputes the real total with exact decimals.
  const estimate = Number(quantity) * Number(unitPrice);

  /** Keep quantity in step with the page/word count for per-page and per-word services. */
  function syncQuantity(pages: string, words: string) {
    if (!service) return;
    const q = quantityFromTranslation(service.unit, Number(pages) || 0, Number(words) || 0);
    if (q !== null) form.setValue("quantity", String(q), { shouldValidate: q > 0 });
  }

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const res = await saveWorkOrder(workOrderId ?? null, values);
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as keyof WorkOrderFormValues, { message });
        }
        toast.error(res.error);
        return;
      }
      toast.success(workOrderId ? "Work order updated" : "Work order created");
      setOpen(false);
      if (workOrderId) router.refresh();
      else router.push(`/work-orders/${res.data.id}`);
    });
  }

  const byCategory = Object.entries(
    options.services.reduce<Record<string, typeof options.services>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {}),
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(initial());
          setCustomer(defaultCustomer ?? null);
        }
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{workOrderId ? "Edit work order" : "New work order"}</SheetTitle>
          <SheetDescription>The total is calculated from quantity × unit rate (excl. VAT).</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ fieldState }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
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

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(id) => {
                        field.onChange(id);
                        const s = options.services.find((x) => x.id === id);
                        if (!s) return;
                        form.setValue("unitPrice", s.defaultPrice, { shouldValidate: true });
                        if (isTranslation(s.category)) {
                          form.setValue("translation.isCertified", s.category === "LEGAL_TRANSLATION");
                          const t = form.getValues("translation");
                          const q = quantityFromTranslation(s.unit, Number(t.pageCount) || 0, Number(t.wordCount) || 0);
                          if (q) form.setValue("quantity", String(q));
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full min-w-0">
                          <span className="min-w-0 flex-1 truncate text-left">
                            <SelectValue placeholder="Choose a service…" />
                          </span>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {byCategory.map(([category, services]) => (
                          <SelectGroup key={category}>
                            <SelectLabel>{SERVICE_CATEGORY_LABEL[category as ServiceCategory]}</SelectLabel>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.title} · QAR {s.defaultPrice}/{SERVICE_UNIT_LABEL[s.unit]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {translating && (
                <fieldset className="bg-muted/40 space-y-4 rounded-lg border p-4">
                  <legend className="px-1 text-sm font-medium">Translation details</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["sourceLang", "targetLang"] as const).map((name) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={`translation.${name}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{name === "sourceLang" ? "From" : "To"}</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Language" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {LANGUAGES.map((l) => (
                                  <SelectItem key={l} value={l}>
                                    {l}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    {(["pageCount", "wordCount"] as const).map((name) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={`translation.${name}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{name === "pageCount" ? "Pages" : "Words"}</FormLabel>
                            <FormControl>
                              <Input
                                inputMode="numeric"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  const t = form.getValues("translation");
                                  syncQuantity(t.pageCount, t.wordCount);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormField
                    control={form.control}
                    name="translation.isCertified"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                        </FormControl>
                        <FormLabel className="font-normal">Certified (MOJ legal translation, stamped)</FormLabel>
                      </FormItem>
                    )}
                  />
                </fieldset>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity{service ? ` (${SERVICE_UNIT_LABEL[service.unit]}s)` : ""}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit rate (QAR)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Total (excl. VAT)</div>
                  <div className="flex h-8 items-center text-sm font-semibold tabular-nums" aria-live="polite">
                    {Number.isFinite(estimate) && estimate > 0
                      ? `QAR ${estimate.toLocaleString("en-QA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Deadline</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned to</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {options.users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Document name, client instructions…" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {workOrderId ? "Save changes" : "Create work order"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
