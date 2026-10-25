import {
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  Handshake,
  IdCard,
  Languages,
  LayoutDashboard,
  ListTodo,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { canAccessPath } from "@/lib/auth/permissions";

export type NavItem = { title: string; href: string; icon: LucideIcon; keywords?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "kpi"] }] },
  {
    label: "Operations",
    items: [
      { title: "Work Orders", href: "/work-orders", icon: ClipboardList, keywords: ["jobs", "orders", "kanban"] },
      { title: "Translation", href: "/translation", icon: Languages, keywords: ["pipeline", "pages", "words"] },
      { title: "Tasks", href: "/tasks", icon: ListTodo, keywords: ["todo", "staff"] },
      { title: "Follow-ups", href: "/follow-ups", icon: BellRing, keywords: ["reminders", "expiry", "visa", "passport"] },
      { title: "Outsourced", href: "/outsourced", icon: Handshake, keywords: ["freelancers", "vendors"] },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Customers", href: "/customers", icon: Users, keywords: ["clients", "crm"] },
      { title: "Documents", href: "/documents", icon: FolderOpen, keywords: ["files", "passport", "qid", "uploads"] },
      { title: "Services", href: "/services", icon: BookOpen, keywords: ["rates", "price list"] },
    ],
  },
  { label: "Team", items: [{ title: "Employees", href: "/employees", icon: IdCard, keywords: ["staff", "users"] }] },
  {
    label: "Finance",
    items: [
      { title: "Invoices & Quotes", href: "/finance/invoices", icon: FileText, keywords: ["billing", "tax invoice", "quotation", "vat"] },
      { title: "Payments", href: "/finance/payments", icon: Wallet, keywords: ["collections", "cash", "card"] },
      { title: "Expenses", href: "/finance/expenses", icon: Receipt, keywords: ["costs", "rent", "bills"] },
      { title: "Profit & Loss", href: "/finance/profit-loss", icon: TrendingUp, keywords: ["p&l", "net profit"] },
    ],
  },
  { label: "Reports", items: [{ title: "Reports", href: "/reports", icon: BarChart3, keywords: ["analytics", "export", "vat report"] }] },
  { label: "Admin", items: [{ title: "Settings", href: "/settings", icon: Settings, keywords: ["company", "vat rate", "cr number", "logo", "invoice terms"] }] },
];

/** Navigation filtered to what the role may open; empty groups are dropped. */
export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAccessPath(role, i.href)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
