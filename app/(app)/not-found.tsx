import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Not found" };

/** notFound() inside the app (deleted customer, wrong invoice id, …) — rendered inside the sidebar shell. */
export default function NotFound({ className }: { className?: string }) {
  return (
    <StatusPage
      icon={FileQuestion}
      title="We couldn't find that"
      className={className}
      actions={
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    >
      The page or record doesn&apos;t exist, or it has been deleted. Check the link and try again.
    </StatusPage>
  );
}
