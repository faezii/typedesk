"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRIAL_DAYS } from "@/lib/validation/signup";
import { signUp, type SignUpState } from "@/server/actions/signup";

export function SignUpForm() {
  const t = useT();
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {});

  if (state.done) {
    return (
      <div>
        <MailCheck className="text-primary size-8" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("Check your email")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("We've sent a confirmation link to {email}. Open it to activate your center, then sign in.", { email: state.email ?? "" })}
        </p>
        <Button asChild variant="outline" className="mt-6 h-10 w-full">
          <Link href="/login">{t("Go to sign in")}</Link>
        </Button>
      </div>
    );
  }

  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={state.values?.[name]} className="h-10" aria-invalid={!!state.fieldErrors?.[name] || undefined} {...props} />
      {state.fieldErrors?.[name] && <p className="text-destructive text-sm">{t(state.fieldErrors[name])}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Start your free trial")}</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{t("{days} days free, no card needed. Your center's data is private to your team.", { days: TRIAL_DAYS })}</p>

      <form action={action} className="mt-8 space-y-4" noValidate>
        {state.error && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {t(state.error)}
          </div>
        )}
        {field("center", t("Center name"), { required: true, autoFocus: true, autoComplete: "organization", placeholder: t("e.g. Al Noor Typing Center") })}
        {field("name", t("Your name"), { required: true, autoComplete: "name" })}
        {field("email", t("Email"), { type: "email", required: true, autoComplete: "username" })}
        {field("phone", t("Phone (optional)"), { type: "tel", autoComplete: "tel", placeholder: "+974 5512 3456" })}
        {field("password", t("Password"), { type: "password", required: true, autoComplete: "new-password" })}
        {field("confirm", t("Confirm password"), { type: "password", required: true, autoComplete: "new-password" })}
        {/* Honeypot: hidden from people and screen readers, filled in by bots. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Create my center")}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-sm">
        {t("Already have an account?")}{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">{t("Sign in")}</Link>
      </p>
    </div>
  );
}
