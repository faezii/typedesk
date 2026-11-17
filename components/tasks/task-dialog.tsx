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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkOrderPicker, type WorkOrderOption } from "@/components/work-orders/work-order-picker";
import { taskSchema, type TaskFormValues } from "@/lib/validation/team";
import { saveTask } from "@/server/actions/tasks";

const EMPTY: TaskFormValues = { title: "", description: "", priority: "NORMAL", deadline: "", assignedToId: "", workOrderId: "" };

export function TaskDialog({
  users,
  taskId,
  defaultValues,
  defaultWorkOrder,
  children,
}: {
  users: { id: string; name: string }[];
  taskId?: string;
  defaultValues?: TaskFormValues;
  defaultWorkOrder?: WorkOrderOption;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [workOrder, setWorkOrder] = useState<WorkOrderOption | null>(defaultWorkOrder ?? null);
  const initial = () => ({ ...(defaultValues ?? EMPTY), workOrderId: defaultWorkOrder?.id ?? defaultValues?.workOrderId ?? "" });
  const form = useForm<TaskFormValues, unknown, z.output<typeof taskSchema>>({ resolver: zodResolver(taskSchema), defaultValues: initial() });

  function onSubmit() {
    startTransition(async () => {
      const res = await saveTask(taskId ?? null, form.getValues());
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) form.setError(field as keyof TaskFormValues, { message });
        return void toast.error(t(res.error));
      }
      toast.success(taskId ? t("Task updated") : t("Task created"));
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
          <DialogTitle>{taskId ? t("Edit task") : t("New task")}</DialogTitle>
          <DialogDescription>{t("Link it to a work order so the assignee sees the client's notes and revision history.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Task")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("e.g. Proofread marriage certificate translation")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Description")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Priority")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NORMAL">{t("Normal")}</SelectItem>
                        <SelectItem value="HIGH">{t("High")}</SelectItem>
                        <SelectItem value="URGENT">{t("Urgent")}</SelectItem>
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
                    <FormLabel>{t("Deadline")}</FormLabel>
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
                  <FormLabel>{t("Assignee")}</FormLabel>
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
              name="workOrderId"
              render={() => (
                <FormItem>
                  <FormLabel>{t("Work order")}</FormLabel>
                  <WorkOrderPicker
                    value={workOrder}
                    onChange={(w) => {
                      setWorkOrder(w);
                      form.setValue("workOrderId", w?.id ?? "");
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("Cancel")}</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {taskId ? t("Save") : t("Create task")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
