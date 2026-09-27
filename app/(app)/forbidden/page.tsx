import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full">
        <ShieldX className="size-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Your role doesn&apos;t include this section. Ask an administrator if you need access.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
