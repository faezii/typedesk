"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActivePath, navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = navForRole(role);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="bg-sidebar-border mx-2 mb-1.5 h-px first:hidden" aria-hidden />
          ) : (
            <div className="text-sidebar-foreground/45 px-3 pb-1.5 text-[11px] font-medium tracking-wider uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/nav relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  "focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-primary/15 text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <span className="bg-sidebar-primary absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full" aria-hidden />
                )}
                <item.icon
                  className={cn(
                    "size-[18px] shrink-0 transition-colors",
                    active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-accent-foreground",
                  )}
                />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}
