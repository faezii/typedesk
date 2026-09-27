"use client";

import { LogOut } from "lucide-react";
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
import { logout } from "@/server/actions/auth";

export type ShellUser = { name: string; email: string; role: Role; department: Department };

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MANAGER: "Manager", FINANCE: "Finance", STAFF: "Staff" };
const DEPT_LABEL: Record<Department, string> = {
  MANAGEMENT: "Management",
  TYPING: "Typing",
  TRANSLATION: "Translation",
  FINANCE: "Finance",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:pr-2.5" aria-label="Account menu">
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
            {ROLE_LABEL[user.role]} · {DEPT_LABEL[user.department]}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut /> Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
