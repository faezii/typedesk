import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export async function Panel({
  title,
  description,
  href,
  className,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <section className={cn("bg-card flex min-w-0 flex-col rounded-xl border", className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-medium">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline">
            {t("View all")}{" "}<ArrowRight className="rtl:-scale-x-100 size-3" />
          </Link>
        )}
      </header>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyList({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>;
}
