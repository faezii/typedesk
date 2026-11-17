"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { SERVICE_CATEGORY_LABEL, SERVICE_UNIT_LABEL } from "@/lib/labels";
import { serviceSchema, type ServiceFormValues } from "@/lib/validation/work-order";
import { saveService, setServiceActive } from "@/server/actions/services";

const EMPTY: ServiceFormValues = { title: "", category: "LEGAL_TRANSLATION", unit: "PAGE", defaultPrice: "", description: "" };

export function ServiceDialog({ serviceId, defaultValues, children }: { serviceId?: string; defaultValues?: ServiceFormValues; children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ServiceFormValues, unknown, z.output<typeof serviceSchema>>({ resolver: zodResolver(serviceSchema), defaultValues: defaultValues ?? EMPTY });

  function onSubmit() {
    startTransition(async () => {
      const res = await saveService(serviceId ?? null, form.getValues());
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) form.setError(field as keyof ServiceFormValues, { message });
        return void toast.error(t(res.error));
      }
      toast.success(serviceId ? t("Service updated") : t("Service added"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues ?? EMPTY);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{serviceId ? t("Edit service") : t("New service")}</DialogTitle>
          <DialogDescription>{t("The default rate pre-fills new work orders; it can be changed per order. Existing orders keep their price.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Title")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t("Category")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SERVICE_CATEGORY_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Charged per")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SERVICE_UNIT_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultPrice"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("Default rate (QAR, excl. VAT)")}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Description")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("Cancel")}</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {serviceId ? t("Save") : t("Add service")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ActiveToggle({ id, active, label }: { id: string; active: boolean; label: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox
        checked={active}
        disabled={pending}
        aria-label={t("{label} active", { label })}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const res = await setServiceActive(id, v === true);
            if (!res.ok) toast.error(t(res.error));
            router.refresh();
          })
        }
      />
      <span className={active ? "" : "text-muted-foreground"}>{active ? t("Active") : t("Inactive")}</span>
    </label>
  );
}
