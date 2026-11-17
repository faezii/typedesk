"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlarmClockPlus, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { CustomerPicker, type CustomerOption } from "@/components/customers/customer-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FOLLOW_UP_TYPE_LABEL } from "@/lib/labels";
import { followUpSchema, type FollowUpFormValues } from "@/lib/validation/team";
import { saveFollowUp, setFollowUpDone, snoozeFollowUp } from "@/server/actions/follow-ups";

const EMPTY: FollowUpFormValues = { title: "", type: "GENERAL", deadline: "", customerId: "", assignedToId: "", notes: "" };

export function FollowUpDialog({
  users,
  followUpId,
  defaultValues,
  defaultCustomer,
  children,
}: {
  users: { id: string; name: string }[];
  followUpId?: string;
  defaultValues?: FollowUpFormValues;
  defaultCustomer?: CustomerOption;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(defaultCustomer ?? null);
  const initial = () => ({ ...(defaultValues ?? EMPTY), customerId: defaultCustomer?.id ?? defaultValues?.customerId ?? "" });
  const form = useForm<FollowUpFormValues, unknown, z.output<typeof followUpSchema>>({ resolver: zodResolver(followUpSchema), defaultValues: initial() });

  function onSubmit() {
    startTransition(async () => {
      const res = await saveFollowUp(followUpId ?? null, form.getValues());
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) form.setError(field as keyof FollowUpFormValues, { message });
        return void toast.error(t(res.error ?? ""));
      }
      toast.success(followUpId ? t("Follow-up updated") : t("Follow-up scheduled"));
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
          setCustomer(defaultCustomer ?? null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{followUpId ? t("Edit follow-up") : t("New follow-up")}</DialogTitle>
          <DialogDescription>{t("Passport and QID renewals and overdue-invoice reminders are scheduled automatically.")}</DialogDescription>
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
                    <Input placeholder={t("e.g. Residence permit renewal — collect passport")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Type")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(FOLLOW_UP_TYPE_LABEL).map(([v, l]) => (
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
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Due date")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="customerId"
              render={() => (
                <FormItem>
                  <FormLabel>{t("Customer")}</FormLabel>
                  <CustomerPicker
                    value={customer}
                    placeholder={t("Optional — search by name or phone")}
                    onChange={(c) => {
                      setCustomer(c);
                      form.setValue("customerId", c?.id ?? "");
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Assigned to")}</FormLabel>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("Unassigned")}</SelectItem>
                      {users.map((u) => (
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
                  <FormLabel>{t("Notes")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
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
                {followUpId ? t("Save") : t("Schedule")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** One-click Done (or Reopen) and Snooze 7 days. */
export function FollowUpQuickActions({ id, done, title }: { id: string; done: boolean; title: string }) {
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

  if (done) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setFollowUpDone(id, false), "Reopened")} aria-label={t("Reopen {title}", { title })}>
        <RotateCcw /> {t("Reopen")}</Button>
    );
  }
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setFollowUpDone(id, true), "Marked done")} aria-label={t("Mark {title} done", { title })}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />} {t("Done")}</Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={t("Snooze {title} for 7 days", { title })}
        onClick={() =>
          startTransition(async () => {
            const res = await snoozeFollowUp(id);
            if (!res.ok) toast.error(t(res.error));
            else toast.success(t("Snoozed until {until}", { until: res.data.until }));
            router.refresh();
          })
        }
      >
        <AlarmClockPlus /> {t("7 days")}</Button>
    </div>
  );
}
