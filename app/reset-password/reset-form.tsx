"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword, type ResetState } from "@/server/actions/password-reset";

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (state.done) {
    return (
      <div>
        <CircleCheck className="text-primary size-8" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("Password changed")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("Sign in with your new password.")}</p>
        <Button asChild className="mt-6 h-10 w-full">
          <Link href="/login">{t("Sign in")}</Link>
        </Button>
      </div>
    );
  }

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? <p className="text-destructive text-sm">{t(state.fieldErrors[name])}</p> : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Choose a new password")}</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{t("At least 8 characters, with letters and a number.")}</p>

      <form action={action} className="mt-8 space-y-5" noValidate>
        <input type="hidden" name="token" value={token} />
        {state.error && !state.fieldErrors && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              {t(state.error)}{" "}
              <Link href="/forgot-password" className="font-medium underline underline-offset-4">{t("Request a new link")}</Link>
            </span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="next">{t("New password")}</Label>
          <Input id="next" name="next" type="password" autoComplete="new-password" required autoFocus className="h-10" aria-invalid={!!state.fieldErrors?.next || undefined} />
          {fieldError("next")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t("Confirm new password")}</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-10" aria-invalid={!!state.fieldErrors?.confirm || undefined} />
          {fieldError("confirm")}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Save new password")}
        </Button>
      </form>
    </div>
  );
}
