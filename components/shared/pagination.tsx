import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Server-rendered prev/next that keeps the current filters. */
export function Pagination({
  page,
  pageSize,
  total,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));
    if (p > 1) sp.set("page", String(p));
    return `?${sp}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;

  return (
    <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
      <span className="tabular-nums">
        {from}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Previous page">
              <ChevronLeft /> Prev
            </Link>
          ) : (
            <span>
              <ChevronLeft /> Prev
            </span>
          )}
        </Button>
        <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
          {page < pages ? (
            <Link href={href(page + 1)} aria-label="Next page">
              Next <ChevronRight />
            </Link>
          ) : (
            <span>
              Next <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
