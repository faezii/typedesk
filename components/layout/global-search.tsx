"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, Loader2, Search, User } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { globalSearch, type SearchResults } from "@/server/actions/search";

const EMPTY: SearchResults = { customers: [], workOrders: [], invoices: [] };

const noopSubscribe = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function GlobalSearch({ role }: { role: Role }) {
  const router = useRouter();
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<{ q: string; results: SearchResults }>({ q: "", results: EMPTY });
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  // ⌘K / Ctrl+K and "/" open the palette
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced server search; stale responses are dropped.
  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch(q);
        if (id === requestId.current) setFetched({ q, results: res });
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Only show results that belong to the current query.
  const results = fetched.q === query.trim() ? fetched.results : EMPTY;
  const loading = pending || (query.trim().length >= 2 && fetched.q !== query.trim());

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = navForRole(role).flatMap((g) => g.items);
    if (!q) return items;
    return items.filter((i) => [i.title, ...(i.keywords ?? [])].some((k) => k.toLowerCase().includes(q)));
  }, [query, role]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasRecords = results.customers.length + results.workOrders.length + results.invoices.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "border-input bg-muted/40 text-muted-foreground hover:bg-muted flex h-9 w-full max-w-md items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        )}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search customers, orders, invoices…</span>
        <kbd className="bg-background text-muted-foreground ml-auto hidden rounded border px-1.5 font-mono text-[11px] sm:inline-block">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
        title="Search"
        description="Search customers, work orders and invoices"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Name, phone, Emirates ID, WO-2026-…, INV-2026-…"
          />
          <CommandList className="max-h-[min(420px,60vh)]">
            {loading && (
              <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> Searching…
              </div>
            )}
            {!loading && <CommandEmpty>No matches found.</CommandEmpty>}

            {results.customers.length > 0 && (
              <CommandGroup heading="Customers">
                {results.customers.map((c) => (
                  <CommandItem key={c.id} value={`customer-${c.id}`} onSelect={() => go(`/customers/${c.id}`)}>
                    <User className="text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate">{c.name}</div>
                      <div className="text-muted-foreground truncate text-xs">{c.subtitle}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.workOrders.length > 0 && (
              <CommandGroup heading="Work orders">
                {results.workOrders.map((w) => (
                  <CommandItem key={w.id} value={`wo-${w.id}`} onSelect={() => go(`/work-orders/${w.id}`)}>
                    <ClipboardList className="text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-mono text-[13px]">{w.orderNo}</div>
                      <div className="text-muted-foreground truncate text-xs">{w.subtitle}</div>
                    </div>
                    <CommandShortcut className="tracking-normal">{w.status.replaceAll("_", " ").toLowerCase()}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.invoices.length > 0 && (
              <CommandGroup heading="Invoices">
                {results.invoices.map((i) => (
                  <CommandItem key={i.id} value={`inv-${i.id}`} onSelect={() => go(`/finance/invoices/${i.id}`)}>
                    <FileText className="text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-mono text-[13px]">{i.invoiceNo}</div>
                      <div className="text-muted-foreground truncate text-xs">{i.subtitle}</div>
                    </div>
                    <CommandShortcut className="tracking-normal tabular-nums">{i.total}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {pages.length > 0 && (!hasRecords || query.trim().length < 2) && (
              <CommandGroup heading="Go to">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon className="text-muted-foreground" />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
