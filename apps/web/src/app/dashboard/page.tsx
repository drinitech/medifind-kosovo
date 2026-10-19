"use client";

import { AlertTriangle, BadgeCheck, Clock, FileSpreadsheet, Hourglass, Package, PackageX, Plus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { HistoryList } from "@/components/dashboard/history-list";
import { ManagerGate } from "@/components/dashboard/manager-gate";
import { PharmacyProfileForm } from "@/components/dashboard/pharmacy-profile-form";
import { usePharmacy } from "@/components/dashboard/pharmacy-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { timeAgo } from "@/lib/format";
import type { HistoryEntry, InventoryStats, Paginated } from "@/lib/types";

export default function DashboardOverviewPage() {
  const { user, refresh } = useAuth();
  const { pharmacyId } = usePharmacy();

  if (user?.role === "PHARMACY_MANAGER" && !pharmacyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Regjistroni farmacinë"
          description="Plotësoni të dhënat publike të farmacisë. Pas verifikimit nga administratori, farmacia shfaqet në kërkime."
        />
        <Card>
          <CardContent className="pt-6">
            <PharmacyProfileForm onSaved={() => void refresh()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ManagerGate>{(id) => <Overview pharmacyId={id} />}</ManagerGate>;
}

function Overview({ pharmacyId }: { pharmacyId: string }) {
  const stats = useApi<InventoryStats>("/pharmacy/inventory/stats", { pharmacyId });
  const history = useApi<Paginated<HistoryEntry>>("/pharmacy/inventory/history", { pharmacyId, pageSize: 6 });
  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={s?.pharmacy.name ?? "Paneli i farmacisë"}
        description={s ? `Përditësimi i fundit i inventarit: ${s.lastUpdate ? timeAgo(s.lastUpdate) : "ende asnjë"}` : undefined}
        actions={
          <>
            <Button className="h-9" asChild>
              <Link href="/dashboard/inventory?new=1"><Plus aria-hidden /> Shto bar</Link>
            </Button>
            <Button variant="outline" className="h-9" asChild>
              <Link href="/dashboard/import"><FileSpreadsheet aria-hidden /> Importo skedar</Link>
            </Button>
          </>
        }
      />

      {s && !s.pharmacy.isVerified ? (
        <Alert>
          <Hourglass aria-hidden />
          <AlertTitle>Farmacia pret verifikimin</AlertTitle>
          <AlertDescription>
            Mund ta përgatitni inventarin tani. Farmacia dhe inventari i saj do të shfaqen publikisht pasi administratori ta verifikojë.
          </AlertDescription>
        </Alert>
      ) : s ? (
        <Alert className="border-success/30 bg-success-soft">
          <BadgeCheck className="text-success" aria-hidden />
          <AlertTitle>Farmacia është e verifikuar</AlertTitle>
          <AlertDescription>Inventari juaj aktiv shfaqet në kërkimet publike si disponueshmëri e raportuar.</AlertDescription>
        </Alert>
      ) : null}

      {stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.reload} />
      ) : !s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Package} label="Barna aktive në inventar" value={s.activeEntries} hint={`${s.inStock} në dispozicion`} href="/dashboard/inventory" />
          <StatCard icon={AlertTriangle} label="Sasi e ulët" value={s.lowStock} tone="warning" href="/dashboard/inventory?status=LOW_STOCK" />
          <StatCard icon={PackageX} label="Nuk ka / e panjohur" value={s.outOfStock + s.unknown} hint={`${s.outOfStock} nuk ka · ${s.unknown} e panjohur`} tone="danger" href="/dashboard/inventory?status=OUT_OF_STOCK,UNKNOWN" />
          <StatCard
            icon={Clock}
            label="Raporte të vjetruara"
            value={s.staleEntries}
            hint={`Më të vjetra se ${s.thresholds.staleHours} orë`}
            tone={s.staleEntries > 0 ? "danger" : undefined}
            href="/dashboard/inventory?freshness=stale"
          />
        </div>
      )}

      {s && s.staleEntries > 0 ? (
        <Alert variant="destructive">
          <Clock aria-hidden />
          <AlertTitle>{s.staleEntries} barna kanë raport të vjetruar</AlertTitle>
          <AlertDescription>
            Përdoruesit i shohin këto si “të vjetruara”. Përditësoni sasitë ose konfirmojini si aktuale nga faqja e inventarit.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ndryshimet e fundit</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">Shiko të gjitha</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {history.error ? (
            <ErrorState error={history.error} onRetry={history.reload} />
          ) : !history.data ? (
            <ListSkeleton rows={3} />
          ) : history.data.items.length === 0 ? (
            <EmptyState title="Ende pa ndryshime" description="Shtoni barin e parë ose importoni një skedar." />
          ) : (
            <HistoryList items={history.data.items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  hint?: string;
  tone?: "warning" | "danger";
  href: string;
}) {
  const toneClass = tone === "warning" ? "bg-warning-soft text-[oklch(0.45_0.11_65)]" : tone === "danger" ? "bg-danger-soft text-destructive" : "bg-accent text-accent-foreground";
  return (
    <Link href={href} className="rounded-xl focus-visible:outline-2">
      <Card className="h-full gap-2 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={`flex size-8 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </Card>
    </Link>
  );
}
