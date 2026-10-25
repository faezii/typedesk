"use client"; // error boundaries must be client components

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

/** Unexpected errors in a page (rendered inside the shell); app/error.tsx covers the layout itself. */
export default function ErrorPage({ error, retry, className }: { error: Error & { digest?: string }; retry: () => void; className?: string }) {
  return (
    <StatusPage
      icon={TriangleAlert}
      destructive
      title="Something went wrong"
      className={className}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Dashboard</Link>
          </Button>
        </>
      }
    >
      This page couldn&apos;t be loaded. Try again; if it keeps happening, tell your administrator{error.digest ? " and quote the reference below" : ""}.
      {error.digest && <p className="mt-2 font-mono text-xs">Reference: {error.digest}</p>}
    </StatusPage>
  );
}
