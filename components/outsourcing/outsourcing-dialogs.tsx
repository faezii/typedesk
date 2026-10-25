"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkOrderPicker, type WorkOrderOption } from "@/components/work-orders/work-order-picker";
import { toDateInput } from "@/lib/dates";
import { LANGUAGES } from "@/lib/labels";
import { assignmentSchema, vendorSchema, type AssignmentFormValues, type VendorFormValues } from "@/lib/validation/outsourcing";
import { saveAssignment, saveVendor } from "@/server/actions/outsourcing";

const EMPTY_VENDOR: VendorFormValues = { name: "", type: "FREELANCER", phone: "", email: "", languages: [], notes: "" };

export function VendorDialog({ vendorId, defaultValues, children }: { vendorId?: string; defaultValues?: VendorFormValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<VendorFormValues, unknown, z.output<typeof vendorSchema>>({ resolver: zodResolver(vendorSchema), defaultValues: defaultValues ?? EMPTY_VENDOR });
  const languages = useWatch({ control: form.control, name: "languages" });

  function onSubmit() {
    startTransition(async () => {
      const res = await saveVendor(vendorId ?? null, form.getValues());
      if (!res.ok) {
        for (const [f, m] of Object.entries(res.fieldErrors ?? {})) form.setError(f as keyof VendorFormValues, { message: m });
        return void toast.error(res.error);
      }
      toast.success(vendorId ? "Vendor updated" : "Vendor added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && form.reset(defaultValues ?? EMPTY_VENDOR))}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendorId ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>Freelance translators and agencies you outsource work to.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FREELANCER">Freelancer</SelectItem>
                        <SelectItem value="AGENCY">Agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {(["phone", "email"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className={name === "email" ? "sm:col-span-2" : undefined}>
                      <FormLabel>{name === "phone" ? "Phone" : "Email"}</FormLabel>
                      <FormControl>
                        <Input type={name === "email" ? "email" : "tel"} placeholder="Optional" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Languages</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {LANGUAGES.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={languages.includes(l)}
                      onCheckedChange={(v) => form.setValue("languages", v ? [...languages, l] : languages.filter((x) => x !== l))}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Rates, specialities, bank details reference…" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {vendorId ? "Save" : "Add vendor"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentDialog({
  vendors,
  jobId,
  defaultValues,
  defaultWorkOrder,
  children,
}: {
  vendors: { id: string; name: string; type: string; languages: string[] }[];
  jobId?: string;
  defaultValues?: AssignmentFormValues;
  defaultWorkOrder?: WorkOrderOption;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [workOrder, setWorkOrder] = useState<WorkOrderOption | null>(defaultWorkOrder ?? null);
  const initial = (): AssignmentFormValues =>
    defaultValues ?? { workOrderId: defaultWorkOrder?.id ?? "", vendorId: "", description: "", agreementCost: "", sentAt: toDateInput(new Date()), dueAt: "" };
  const form = useForm<AssignmentFormValues, unknown, z.output<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema), defaultValues: initial() });

  function onSubmit() {
    startTransition(async () => {
      const res = await saveAssignment(jobId ?? null, form.getValues());
      if (!res.ok) {
        for (const [f, m] of Object.entries(res.fieldErrors ?? {})) form.setError(f as keyof AssignmentFormValues, { message: m });
        return void toast.error(res.error);
      }
      toast.success(jobId ? "Job updated" : "Work outsourced");
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
          form.reset(initial());
          setWorkOrder(defaultWorkOrder ?? null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{jobId ? "Edit outsourced job" : "Outsource work"}</DialogTitle>
          <DialogDescription>Record what was sent to a freelancer or agency and the agreed cost (QAR).</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="workOrderId"
              render={() => (
                <FormItem>
                  <FormLabel>Work order</FormLabel>
                  <WorkOrderPicker
                    value={workOrder}
                    onChange={(w) => {
                      setWorkOrder(w);
                      form.setValue("workOrderId", w?.id ?? "", { shouldValidate: true });
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full min-w-0">
                        <span className="min-w-0 flex-1 truncate text-left">
                          <SelectValue placeholder="Choose a vendor…" />
                        </span>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.languages.length > 0 && <span className="text-muted-foreground"> · {v.languages.slice(0, 3).join(", ")}</span>}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was sent</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="e.g. Russian → English translation of 6-page contract" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="agreementCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreed cost (QAR)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(["sentAt", "dueAt"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{name === "sentAt" ? "Sent on" : "Due back"}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {jobId ? "Save" : "Outsource"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
