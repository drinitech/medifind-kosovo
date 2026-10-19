"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { usePharmacy } from "./pharmacy-context";

/** Renders children only for pharmacy managers that have a pharmacy; explains what to do otherwise. */
export function ManagerGate({ children }: { children: (pharmacyId: string) => React.ReactNode }) {
  const { user } = useAuth();
  const { pharmacyId } = usePharmacy();
  if (user?.role !== "PHARMACY_MANAGER") {
    return (
      <EmptyState
        icon={Store}
        title="Kjo faqe është për menaxherët e farmacive"
        description={user?.role === "ADMIN" ? "Si administrator, inventarin e shqyrtoni nga paneli i administratorit." : "Llogaria juaj është llogari përdoruesi."}
        action={
          <Button asChild>
            <Link href={user?.role === "ADMIN" ? "/admin" : "/dashboard/alerts"}>Vazhdo</Link>
          </Button>
        }
      />
    );
  }
  if (!pharmacyId) {
    return (
      <EmptyState
        icon={Store}
        title="Ende nuk keni regjistruar farmacinë"
        description="Plotësoni profilin e farmacisë për të filluar menaxhimin e inventarit."
        action={
          <Button asChild>
            <Link href="/dashboard">Regjistro farmacinë</Link>
          </Button>
        }
      />
    );
  }
  return <>{children(pharmacyId)}</>;
}
