"use client";


import { useT } from "@/components/i18n";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { GlobalSearch } from "./global-search";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu, type ShellUser } from "./user-menu";

export const SIDEBAR_COOKIE = "sidebar_collapsed";

export function AppShell({
  user,
  defaultCollapsed,
  mustChangePassword = false,
  trialDaysLeft = null,
  children,
}: {
  user: ShellUser;
  defaultCollapsed: boolean;
  mustChangePassword?: boolean;
  /** Days left in the free trial; null for paying centers. */
  trialDaysLeft?: number | null;
  children: React.ReactNode;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Ctrl/⌘ + B toggles the sidebar
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh shrink-0 flex-col border-e transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
          <Brand collapsed={collapsed} />
        </div>
        <div
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto",
            collapsed ? "[scrollbar-width:none]" : "[scrollbar-width:thin]",
          )}
        >
          <SidebarNav role={user.role} platformAdmin={user.platformAdmin} collapsed={collapsed} />
        </div>
        <div className={cn("border-sidebar-border border-t p-3", collapsed && "flex justify-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={toggle}
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start dark:hover:bg-sidebar-accent"
                aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
              >
                {collapsed ? <PanelLeftOpen className="rtl:-scale-x-100" /> : <PanelLeftClose className="rtl:-scale-x-100" />}
                {!collapsed && <span>{t("Collapse")}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={t.lang === "ar" ? "left" : "right"}>
              {collapsed ? t("Expand sidebar") : t("Collapse sidebar")} <kbd className="ms-1 font-mono">{t("Ctrl B")}</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 gap-0 p-0 sm:max-w-72 [&>[data-slot=sheet-close]]:text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">{t("Navigation")}</SheetTitle>
          <SheetDescription className="sr-only">{t("Main navigation")}</SheetDescription>
          <div className="border-sidebar-border flex h-14 items-center border-b px-4">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav role={user.role} platformAdmin={user.platformAdmin} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:gap-3 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("Open navigation")}>
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <GlobalSearch role={user.role} platformAdmin={user.platformAdmin} />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        {mustChangePassword && (
          <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm sm:px-6 lg:px-8">
            {t("You're signed in with a temporary password.")}{" "}
            <Link href="/account" className="font-medium underline underline-offset-2">
              {t("Choose your own password")}</Link>
          </div>
        )}
        {trialDaysLeft !== null && (
          <div role="status" className="border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm sm:px-6 lg:px-8">
            {trialDaysLeft <= 1 ? t("Your free trial ends today.") : t("Free trial: {days} days left.", { days: trialDaysLeft })}
          </div>
        )}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
