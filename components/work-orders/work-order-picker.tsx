"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { findWorkOrders } from "@/server/actions/work-orders";

export type WorkOrderOption = { id: string; orderNo: string; subtitle?: string };

/** Searchable work order combobox (order number or customer name). */
export function WorkOrderPicker({ value, onChange }: { value: WorkOrderOption | null; onChange: (w: WorkOrderOption | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkOrderOption[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await findWorkOrders(query);
      if (!cancelled) setResults(rows.map((w) => ({ id: w.id, orderNo: w.orderNo, subtitle: `${w.customer.name} · ${w.service.title}` })));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${value.orderNo}${value.subtitle ? ` · ${value.subtitle}` : ""}` : "Optional — search WO number or customer"}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="WO-2026-…, customer name" />
          <CommandList>
            <CommandEmpty>{query.trim().length < 2 ? "Type at least 2 characters." : "No work orders found."}</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__clear" onSelect={() => (onChange(null), setOpen(false))}>
                  <X /> Not linked to a work order
                </CommandItem>
              </CommandGroup>
            )}
            {query.trim().length >= 2 && results.length > 0 && (
              <CommandGroup heading="Work orders">
                {results.map((w) => (
                  <CommandItem key={w.id} value={w.id} onSelect={() => (onChange(w), setOpen(false))}>
                    <Check className={cn(value?.id === w.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="font-mono text-[13px]">{w.orderNo}</div>
                      <div className="text-muted-foreground truncate text-xs">{w.subtitle}</div>
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
