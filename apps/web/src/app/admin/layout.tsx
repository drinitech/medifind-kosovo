"use client";

import { Building2, ClipboardList, LayoutDashboard, Package, Pill, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/dashboard/app-shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Përmbledhje", icon: LayoutDashboard, exact: true },
  { href: "/admin/pharmacies", label: "Farmacitë", icon: Building2 },
  { href: "/admin/medicines", label: "Katalogu i barnave", icon: Pill },
  { href: "/admin/inventory", label: "Shqyrtimi i inventarit", icon: Package },
  { href: "/admin/users", label: "Përdoruesit", icon: Users },
  { href: "/admin/audit-logs", label: "Regjistri i auditimit", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} allow={["ADMIN"]} title="Administrimi">
      {children}
    </AppShell>
  );
}
