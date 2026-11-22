"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { verifyEmail, type VerifyState } from "@/server/actions/signup";

export function VerifyForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyEmail, {});

  if (state.done) {
    return (
      <div>
        <CircleCheck className="text-primary size-8" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("Email confirmed")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("Your center is ready. Sign in to start.")}</p>
        <Button asChild className="mt-6 h-10 w-full">
          <Link href="/login">{t("Sign in")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Confirm your email")}</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{t("One click and your center is ready.")}</p>
      <form action={action} className="mt-8 space-y-5">
        <input type="hidden" name="token" value={token} />
        {state.error && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              {t(state.error)} {t("Sign in to get a new link.")}
            </span>
          </div>
        )}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Confirm my email")}
        </Button>
      </form>
    </div>
  );
}
