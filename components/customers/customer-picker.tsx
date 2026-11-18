"use client";


import { useT } from "@/components/i18n";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { CustomerFormSheet, EMPTY_CUSTOMER } from "@/components/customers/customer-form-sheet";
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
  placeholder,
  allowClear = true,
  invalid,
}: {
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  // The new-customer form, prefilled from the search text; it lives outside the popover so closing the list doesn't unmount it.
  const [draft, setDraft] = useState<typeof EMPTY_CUSTOMER | null>(null);
  const typed = query.trim();
  const startCreate = () => {
    setOpen(false);
    setDraft(/^\+?[\d\s-]+$/.test(typed) ? { ...EMPTY_CUSTOMER, phone: typed } : { ...EMPTY_CUSTOMER, name: typed });
  };

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
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value?.name ?? placeholder ?? t("Search by name or phone")}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t("Name, phone, QID…")} />
          <CommandList>
            <CommandEmpty>{query.trim().length < 2 ? t("Type at least 2 characters.") : t("No customers found.")}</CommandEmpty>
            {allowClear && value && (
              <CommandGroup>
                <CommandItem value="__clear" onSelect={() => (onChange(null), setOpen(false))}>
                  <X /> {t("Clear selection")}</CommandItem>
              </CommandGroup>
            )}
            {query.trim().length >= 2 && results.length > 0 && (
              <CommandGroup heading={t("Customers")}>
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
            {typed.length >= 2 && (
              <CommandGroup>
                <CommandItem value="__create" onSelect={startCreate}>
                  <UserPlus /> {t("Add “{name}” as a new customer", { name: typed })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
      {draft && (
        <CustomerFormSheet
          open
          defaultValues={draft}
          onOpenChange={(o) => !o && setDraft(null)}
          onCreated={(c) => {
            onChange(c);
            setQuery("");
          }}
        />
      )}
    </Popover>
  );
}
