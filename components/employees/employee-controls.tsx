"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Loader2, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validation/team";
import { createEmployee, deleteEmployee, resetEmployeePassword, setEmployeeActive, updateEmployee } from "@/server/actions/employees";

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "STAFF", label: "Staff", hint: "Own tasks, work orders, customers" },
  { value: "FINANCE", label: "Finance", hint: "Invoices, payments, expenses, reports" },
  { value: "MANAGER", label: "Manager", hint: "Everything except settings and admin accounts" },
  { value: "ADMIN", label: "Admin", hint: "Full access including settings" },
];
const DEPARTMENTS = [
  { value: "MANAGEMENT", label: "Management" },
  { value: "TYPING", label: "Typing" },
  { value: "TRANSLATION", label: "Translation" },
  { value: "FINANCE", label: "Finance" },
] as const;
const EMPTY: EmployeeFormValues = { name: "", email: "", phone: "", role: "STAFF", department: "TYPING" };

export function EmployeeDialog({
  employeeId,
  defaultValues,
  canGrantAdmin,
  children,
}: {
  employeeId?: string;
  defaultValues?: EmployeeFormValues;
  canGrantAdmin: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const form = useForm<EmployeeFormValues, unknown, z.output<typeof employeeSchema>>({ resolver: zodResolver(employeeSchema), defaultValues: defaultValues ?? EMPTY });

  function onSubmit() {
    startTransition(async () => {
      const values = form.getValues();
      const res = employeeId ? await updateEmployee(employeeId, values) : await createEmployee(values);
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) form.setError(field as keyof EmployeeFormValues, { message });
        return void toast.error(t(res.error));
      }
      router.refresh();
      if (res.data && "tempPassword" in res.data) {
        setTempPassword(res.data.tempPassword);
      } else {
        toast.success(t("Employee updated"));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaultValues ?? EMPTY);
          setTempPassword(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {tempPassword ? (
          <TempPasswordView name={form.getValues("name")} password={tempPassword} onDone={() => setOpen(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{employeeId ? t("Edit employee") : t("New employee")}</DialogTitle>
              <DialogDescription>
                {employeeId ? t("Role changes apply on the person's next page load.") : t("A temporary password is generated; they choose their own after signing in.")}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["name", "email", "phone"] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem className={name === "name" ? "sm:col-span-2" : undefined}>
                          <FormLabel>{name === "name" ? t("Full name") : name === "email" ? t("Work email") : t("Mobile")}</FormLabel>
                          <FormControl>
                            <Input
                              type={name === "email" ? "email" : "text"}
                              placeholder={name === "phone" ? "+974 5512 3456" : undefined}
                              autoComplete="off"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Department")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {t(d.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Role")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLE_OPTIONS.filter((r) => canGrantAdmin || r.value !== "ADMIN" || field.value === "ADMIN").map((r) => (
                              <SelectItem key={r.value} value={r.value} disabled={r.value === "ADMIN" && !canGrantAdmin}>
                                {t(r.label)} — <span className="text-muted-foreground">{t(r.hint)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t("Cancel")}</Button>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="animate-spin" />}
                    {employeeId ? t("Save") : t("Create account")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Shown exactly once — the password isn't stored in plain text anywhere. */
function TempPasswordView({ name, password, onDone }: { name: string; password: string; onDone: () => void }) {
  const t = useT();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("Temporary password for {name}", { name })}</DialogTitle>
        <DialogDescription>{t("Share it privately. It won't be shown again — they'll be asked to choose their own after signing in.")}</DialogDescription>
      </DialogHeader>
      <div className="bg-muted flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <code className="font-mono text-lg tracking-wider select-all">{password}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(password).then(() => toast.success(t("Copied")), () => toast.error(t("Copy failed — select and copy manually")))}
        >
          <Copy /> {t("Copy")}</Button>
      </div>
      <DialogFooter>
        <Button onClick={onDone}>{t("Done")}</Button>
      </DialogFooter>
    </>
  );
}

export function EmployeeRowActions({
  id,
  name,
  active,
  editable,
  isSelf,
  deletable,
}: {
  id: string;
  name: string;
  active: boolean;
  editable: boolean;
  isSelf: boolean;
  /** No work on record, so the account can be removed for good. */
  deletable: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  if (!editable) return null;

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={!!password} onOpenChange={(o) => !o && setPassword(null)}>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("Reset password for {name}", { name })}
          title={t("Reset password")}
          onClick={() => {
            if (!confirm(t("Reset {name}'s password? Their current password stops working immediately.", { name }))) return;
            startTransition(async () => {
              const res = await resetEmployeePassword(id);
              if (!res.ok) return void toast.error(t(res.error));
              setPassword(res.data.tempPassword);
              router.refresh();
            });
          }}
        >
          <KeyRound />
        </Button>
        <DialogContent>{password && <TempPasswordView name={name} password={password} onDone={() => setPassword(null)} />}</DialogContent>
      </Dialog>
      {!isSelf && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={active ? t("Deactivate {name}", { name }) : t("Reactivate {name}", { name })}
          title={active ? t("Deactivate") : t("Reactivate")}
          className={active ? "text-muted-foreground hover:text-destructive" : "text-primary"}
          onClick={() => {
            if (active && !confirm(t("Deactivate {name}? They will be signed out and can't sign in until reactivated.", { name }))) return;
            startTransition(async () => {
              const res = await setEmployeeActive(id, !active);
              if (!res.ok) toast.error(t(res.error));
              else toast.success(active ? t("{name} deactivated", { name }) : t("{name} reactivated", { name }));
              router.refresh();
            });
          }}
        >
          {active ? <UserX /> : <UserCheck />}
        </Button>
      )}
      {!isSelf && deletable && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("Delete {name}", { name })}
          title={t("Delete account")}
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (!confirm(t("Delete {name}'s account for good? This can't be undone.", { name }))) return;
            startTransition(async () => {
              const res = await deleteEmployee(id);
              if (!res.ok) toast.error(t(res.error));
              else toast.success(t("{name} deleted", { name }));
              router.refresh();
            });
          }}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
