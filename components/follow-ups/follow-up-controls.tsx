"use client";

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
        return void toast.error(res.error);
      }
      toast.success(followUpId ? "Follow-up updated" : "Follow-up scheduled");
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
          <DialogTitle>{followUpId ? "Edit follow-up" : "New follow-up"}</DialogTitle>
          <DialogDescription>Passport and QID renewals and overdue-invoice reminders are scheduled automatically.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Residence visa stamping — collect passport" {...field} />
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
                    <FormLabel>Type</FormLabel>
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
                    <FormLabel>Due date</FormLabel>
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
                  <FormLabel>Customer</FormLabel>
                  <CustomerPicker
                    value={customer}
                    placeholder="Optional — search by name or phone"
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
                  <FormLabel>Assigned to</FormLabel>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
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
                {followUpId ? "Save" : "Schedule"}
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else toast.success(success);
      router.refresh();
    });

  if (done) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setFollowUpDone(id, false), "Reopened")} aria-label={`Reopen ${title}`}>
        <RotateCcw /> Reopen
      </Button>
    );
  }
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setFollowUpDone(id, true), "Marked done")} aria-label={`Mark ${title} done`}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />} Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={`Snooze ${title} for 7 days`}
        onClick={() =>
          startTransition(async () => {
            const res = await snoozeFollowUp(id);
            if (!res.ok) toast.error(res.error);
            else toast.success(`Snoozed until ${res.data.until}`);
            router.refresh();
          })
        }
      >
        <AlarmClockPlus /> 7 days
      </Button>
    </div>
  );
}
