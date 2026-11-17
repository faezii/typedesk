"use client";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-sidebar-primary text-sidebar-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg shadow-sm shadow-emerald-950/40",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* "T" monogram with a typing cursor */}
        <path d="M5 5h11M10.5 5v14" />
        <path d="M17.5 13v6" />
      </svg>
    </div>
  );
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <BrandMark />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-semibold tracking-tight text-white">{t("TypeDesk")}</div>
          <div className="text-sidebar-foreground/60 truncate text-[11px]">{t("Translation & Typing Center")}</div>
        </div>
      )}
    </div>
  );
}
