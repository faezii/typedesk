"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ForgotState } from "@/server/actions/password-reset";

export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div>
        <MailCheck className="text-primary size-8" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("Check your email")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("If {email} has a TypeDesk account, we've sent it a link to choose a new password. The link works for 30 minutes.", { email: state.email ?? "" })}
        </p>
        <p className="text-muted-foreground mt-3 text-sm">{t("Nothing arrived? Check spam, or ask your administrator to reset your password.")}</p>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Forgot password")}</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{t("Enter your email and we'll send you a link to choose a new password.")}</p>

      <form action={action} className="mt-8 space-y-5" noValidate>
        {state.error && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {t(state.error)}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="username" defaultValue={state.email} required autoFocus className="h-10" />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Send reset link")}
        </Button>
      </form>
      <BackToSignIn />
    </div>
  );
}

export function BackToSignIn() {
  const t = useT();
  return (
    <Link href="/login" className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm">
      <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("Back to sign in")}
    </Link>
  );
}
