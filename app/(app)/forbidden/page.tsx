import Link from "next/link";
import { ShieldX } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <StatusPage
      icon={ShieldX}
      destructive
      title="You don't have access to this page"
      actions={
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    >
      Your role doesn&apos;t include this section. Ask an administrator if you need access.
    </StatusPage>
  );
}
