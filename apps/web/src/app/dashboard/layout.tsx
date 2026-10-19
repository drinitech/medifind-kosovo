"use client";

import { Bell, FileSpreadsheet, History, LayoutDashboard, Package, Store } from "lucide-react";
import { AppShell, type NavItem } from "@/components/dashboard/app-shell";
import { PharmacyProvider, PharmacySwitcher } from "@/components/dashboard/pharmacy-context";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Përmbledhje", icon: LayoutDashboard, roles: ["PHARMACY_MANAGER"], exact: true },
  { href: "/dashboard/inventory", label: "Inventari", icon: Package, roles: ["PHARMACY_MANAGER"] },
  { href: "/dashboard/import", label: "Importo skedar", icon: FileSpreadsheet, roles: ["PHARMACY_MANAGER"] },
  { href: "/dashboard/history", label: "Historiku", icon: History, roles: ["PHARMACY_MANAGER"] },
  { href: "/dashboard/profile", label: "Profili i farmacisë", icon: Store, roles: ["PHARMACY_MANAGER"] },
  { href: "/dashboard/alerts", label: "Njoftimet & alarmet", icon: Bell },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PharmacyProvider>
      <AppShell nav={NAV} allow={["USER", "PHARMACY_MANAGER", "ADMIN"]} title="Paneli" aside={(u) => (u.role === "PHARMACY_MANAGER" ? <PharmacySwitcher /> : null)}>
        {children}
      </AppShell>
    </PharmacyProvider>
  );
}
