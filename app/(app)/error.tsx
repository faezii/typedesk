"use client"; // error boundaries must be client components

import { useT } from "@/components/i18n";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

/** Unexpected errors in a page (rendered inside the shell); app/error.tsx covers the layout itself. */
export default function ErrorPage({ error, retry, className }: { error: Error & { digest?: string }; retry: () => void; className?: string }) {
  const t = useT();
  return (
    <StatusPage
      icon={TriangleAlert}
      destructive
      title={t("Something went wrong")}
      className={className}
      actions={
        <>
          <Button onClick={() => retry()}>{t("Try again")}</Button>
          <Button variant="outline" asChild>
            <Link href="/">{t("Dashboard")}</Link>
          </Button>
        </>
      }
    >
      {error.digest
        ? t("This page couldn't be loaded. Try again; if it keeps happening, tell your administrator and quote the reference below.")
        : t("This page couldn't be loaded. Try again; if it keeps happening, tell your administrator.")}
      {error.digest && <p className="mt-2 font-mono text-xs">{t("Reference: {digest}", { digest: error.digest })}</p>}
    </StatusPage>
  );
}
