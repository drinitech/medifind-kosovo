"use client";

import { AlertTriangle, BadgeCheck, Bell, Building2, Clock, Hourglass, Pill, Users } from "lucide-react";
import Link from "next/link";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { HistoryList } from "@/components/dashboard/history-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { timeAgo } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, FreshnessThresholds, HistoryEntry, Role } from "@/lib/types";

interface Dashboard {
  pharmacies: { total: number; verified: number; unverified: number; inactive: number; withStaleInventory: number };
  medicines: { total: number; active: number };
  users: Partial<Record<Role, number>>;
  inventory: { byStatus: Partial<Record<AvailabilityStatus, number>>; freshness: { fresh: number; aging: number; stale: number }; updatesLast24h: number };
  alerts: { active: number; notificationsLast7d: number };
  thresholds: FreshnessThresholds;
  recentUpdates: HistoryEntry[];
  pendingPharmacies: { id: string; name: string; city: string; createdAt: string }[];
}

const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  IN_STOCK: "bg-success",
  LOW_STOCK: "bg-warning",
  OUT_OF_STOCK: "bg-destructive",
  UNKNOWN: "bg-muted-foreground/50",
};

export default function AdminDashboardPage() {
  const { data, error, reload } = useApi<Dashboard>("/admin/dashboard");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <ListSkeleton rows={4} />;

  const freshTotal = data.inventory.freshness.fresh + data.inventory.freshness.aging + data.inventory.freshness.stale;
  const statusTotal = Object.values(data.inventory.byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const userTotal = Object.values(data.users).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Paneli i administratorit" description="Statistikat llogariten drejtpërdrejt nga baza e të dhënave." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Building2} label="Farmaci të regjistruara" value={data.pharmacies.total} hint={`${data.pharmacies.inactive} të çaktivizuara`} href="/admin/pharmacies" />
        <Stat icon={BadgeCheck} label="Të verifikuara" value={data.pharmacies.verified} hint={`${data.pharmacies.unverified} në pritje`} href="/admin/pharmacies?status=unverified" />
        <Stat icon={Pill} label="Produkte në katalog" value={data.medicines.active} hint={`${data.medicines.total - data.medicines.active} joaktive`} href="/admin/medicines" />
        <Stat icon={Users} label="Përdorues" value={userTotal} hint={`${data.users.PHARMACY_MANAGER ?? 0} menaxherë · ${data.users.ADMIN ?? 0} admin`} href="/admin/users" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Freskia e të dhënave të inventarit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Bar
              segments={[
                { label: `Të freskëta (< ${data.thresholds.agingHours} orë)`, value: data.inventory.freshness.fresh, className: "bg-success" },
                { label: `Jo shumë të reja`, value: data.inventory.freshness.aging, className: "bg-warning" },
                { label: `Të vjetruara (≥ ${data.thresholds.staleHours} orë)`, value: data.inventory.freshness.stale, className: "bg-destructive" },
              ]}
              total={freshTotal}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {data.inventory.updatesLast24h} ndryshime në 24 orët e fundit</span>
              <span className="flex items-center gap-1.5"><AlertTriangle className="size-4" aria-hidden /> {data.pharmacies.withStaleInventory} farmaci me raport të vjetruar</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/inventory?freshness=stale">Shqyrto raportet e vjetruara</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statusi i raportuar (regjistrime aktive)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Bar
              segments={(Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => ({
                label: STATUS_LABELS[s],
                value: data.inventory.byStatus[s] ?? 0,
                className: STATUS_COLORS[s],
              }))}
              total={statusTotal}
            />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bell className="size-4" aria-hidden /> {data.alerts.active} alarme aktive · {data.alerts.notificationsLast7d} njoftime në 7 ditët e fundit
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Përditësimet e fundit të inventarit</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/inventory">Shiko inventarin</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentUpdates.length === 0 ? <p className="text-sm text-muted-foreground">Ende pa përditësime.</p> : <HistoryList items={data.recentUpdates} showPharmacy />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Hourglass className="size-4" aria-hidden /> Në pritje të verifikimit</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pendingPharmacies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Asnjë farmaci në pritje.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.pendingPharmacies.map((p) => (
                  <li key={p.id} className="py-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.city} · regjistruar {timeAgo(p.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/admin/pharmacies?status=unverified">Shqyrto farmacitë</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, href }: { icon: typeof Building2; label: string; value: number; hint?: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl">
      <Card className="h-full gap-2 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </Card>
    </Link>
  );
}

function Bar({ segments, total }: { segments: { label: string; value: number; className: string }[]; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {total > 0 ? segments.map((s) => <div key={s.label} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} />) : null}
      </div>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${s.className}`} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {s.value}
              {total > 0 ? <span className="ml-1 text-xs text-muted-foreground">({Math.round((s.value / total) * 100)}%)</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
