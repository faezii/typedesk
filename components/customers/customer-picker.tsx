"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { findCustomers } from "@/server/actions/customers";

export type CustomerOption = { id: string; name: string; subtitle?: string };

/** Searchable customer combobox (server-side search, debounced). */
export function CustomerPicker({
  value,
  onChange,
  placeholder = "Search by name or phone",
  allowClear = true,
  invalid,
}: {
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await findCustomers(query);
      if (!cancelled) setResults(rows.map((r) => ({ id: r.id, name: r.name, subtitle: [r.companyName, r.phone].filter(Boolean).join(" · ") })));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value?.name ?? placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Name, phone, QID…" />
          <CommandList>
            <CommandEmpty>{query.trim().length < 2 ? "Type at least 2 characters." : "No customers found."}</CommandEmpty>
            {allowClear && value && (
              <CommandGroup>
                <CommandItem value="__clear" onSelect={() => (onChange(null), setOpen(false))}>
                  <X /> Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            {query.trim().length >= 2 && results.length > 0 && (
              <CommandGroup heading="Customers">
                {results.map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => (onChange(c), setOpen(false))}>
                    <Check className={cn(value?.id === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="truncate">{c.name}</div>
                      {c.subtitle && <div className="text-muted-foreground truncate text-xs">{c.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
