"use client";


import { useT } from "@/components/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/server/actions/account";

const FIELDS = [
  { name: "current", label: "Current password", autoComplete: "current-password" },
  { name: "next", label: "New password", autoComplete: "new-password" },
  { name: "confirm", label: "Confirm new password", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const res = await changePassword({ current: String(fd.get("current")), next: String(fd.get("next")), confirm: String(fd.get("confirm")) });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(t(res.error));
          }
          setErrors({});
          form.reset();
          toast.success(t("Password changed"));
          router.refresh();
        });
      }}
    >
      {FIELDS.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>{t(f.label)}</Label>
          <Input id={f.name} name={f.name} type="password" autoComplete={f.autoComplete} required aria-invalid={!!errors[f.name] || undefined} aria-describedby={errors[f.name] ? `${f.name}-error` : undefined} />
          {errors[f.name] && (
            <p id={`${f.name}-error`} className="text-destructive text-sm">
              {errors[f.name]}
            </p>
          )}
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t("Change password")}</Button>
    </form>
  );
}
