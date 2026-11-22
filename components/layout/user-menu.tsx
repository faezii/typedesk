"use client";


import { useSwitchLanguage, useT } from "@/components/i18n";
import Link from "next/link";
import { Building2, KeyRound, Languages, LogOut } from "lucide-react";
import type { Department, Role } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { logout } from "@/server/actions/auth";

export type ShellUser = { name: string; email: string; role: Role; department: Department; center: string; platformAdmin?: boolean };

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MANAGER: "Manager", FINANCE: "Finance", STAFF: "Staff" };
const DEPT_LABEL: Record<Department, string> = {
  MANAGEMENT: "Management",
  TYPING: "Typing",
  TRANSLATION: "Translation",
  FINANCE: "Finance",
};

export function UserMenu({ user }: { user: ShellUser }) {
  const t = useT();
  const language = useSwitchLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:pe-2.5" aria-label={t("Account menu")}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{user.name.split(" ")[0]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-foreground truncate text-sm font-medium">{user.name}</div>
          <div className="text-muted-foreground truncate text-xs">{user.email}</div>
          <div className="text-muted-foreground mt-1.5 text-xs">
            {t(ROLE_LABEL[user.role])} · {t(DEPT_LABEL[user.department])}
          </div>
          <div className="text-muted-foreground truncate text-xs">{user.center}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.platformAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/platform">
              <Building2 /> {t("All centers")}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <KeyRound /> {t("Account & password")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          lang={language.next}
          disabled={language.pending}
          onSelect={(e) => {
            e.preventDefault(); // keep the menu open until the page switches
            language.toggle();
          }}
        >
          <Languages /> {language.label}
        </DropdownMenuItem>
        <form action={logout}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut /> {t("Log out")}</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
