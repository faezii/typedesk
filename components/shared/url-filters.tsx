"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Writes filter values into the URL (resetting to page 1) so lists stay shareable and server-rendered. */
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

export function SearchInput({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const { params, set, pending } = useSetParam();
  const current = params.get(param) ?? "";
  const [value, setValue] = useState(current);

  useEffect(() => {
    if (value.trim() === current) return;
    const t = setTimeout(() => set(param, value.trim() || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `set` is recreated each render; debounce on value only
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pr-8 pl-8"
      />
      {pending && <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />}
    </div>
  );
}

/** A yyyy-mm-dd URL param, e.g. the start or end of a date range. */
export function DateParam({ param, label }: { param: string; label: string }) {
  const { params, set } = useSetParam();
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <span className="shrink-0">{label}</span>
      <Input
        type="date"
        className="h-9 w-full sm:w-38"
        value={params.get(param) ?? ""}
        onChange={(e) => set(param, e.target.value || null)}
      />
    </label>
  );
}

export function FilterSelect({
  param,
  label,
  allLabel,
  options,
}: {
  param: string;
  label: string;
  /** Text for the "no filter" option, e.g. "All types". */
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const { params, set } = useSetParam();
  return (
    <Select value={params.get(param) ?? "all"} onValueChange={(v) => set(param, v === "all" ? null : v)}>
      <SelectTrigger className="h-9 w-full sm:w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
