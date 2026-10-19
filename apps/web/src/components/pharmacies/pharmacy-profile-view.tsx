"use client";

import { ArrowLeft, BadgeCheck, Clock, Mail, MapPin, Navigation, Package, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Pager } from "@/components/common/pager";
import { DemoBadge, FreshnessBadge, ReportedNotice, StatusBadge } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { LazyPharmacyMap } from "@/components/map/lazy-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { dateOnly, dateTime, directionsHref, telHref, timeAgo } from "@/lib/format";
import { DOSAGE_FORM_LABELS } from "@/lib/labels";
import type { Paginated, PharmacyDetail, PublicInventoryRow } from "@/lib/types";

export function PharmacyProfileView({ id }: { id: string }) {
  const pharmacy = useApi<PharmacyDetail>(`/pharmacies/${id}`);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "available">("available");
  const [page, setPage] = useState(1);
  const inventory = useApi<Paginated<PublicInventoryRow>>(pharmacy.data ? `/pharmacies/${pharmacy.data.id}/inventory` : null, {
    q: q.trim() || undefined,
    filter,
    page,
    pageSize: 15,
  });

  if (pharmacy.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ErrorState error={pharmacy.error} onRetry={pharmacy.reload} />
      </div>
    );
  }
  const p = pharmacy.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link href="/pharmacies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Të gjitha farmacitë
      </Link>
      {!p ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="p-0">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold md:text-3xl">{p.name}</h1>
                  {p.isDemo ? <DemoBadge /> : null}
                </div>
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <BadgeCheck className="size-4" aria-hidden /> Farmaci e verifikuar{p.verifiedAt ? ` më ${dateOnly(p.verifiedAt)}` : ""}
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="sr-only">Adresa</dt>
                    <dd>{p.address}, {p.city}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="sr-only">Telefoni</dt>
                    <dd>{p.phone ? <a className="hover:underline" href={telHref(p.phone)}>{p.phone}</a> : <span className="text-muted-foreground">Pa numër publik</span>}</dd>
                  </div>
                </div>
                {p.email ? (
                  <div className="flex gap-2">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <dt className="sr-only">Email</dt>
                      <dd><a className="hover:underline" href={`mailto:${p.email}`}>{p.email}</a></dd>
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="sr-only">Përditësimi i fundit</dt>
                    <dd title={dateTime(p.stats.lastInventoryUpdate)}>
                      Inventari u përditësua {p.stats.lastInventoryUpdate ? timeAgo(p.stats.lastInventoryUpdate) : "— ende pa raport"}
                    </dd>
                  </div>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {p.phone ? (
                  <Button className="h-9" asChild>
                    <a href={telHref(p.phone)}><Phone aria-hidden /> Telefono</a>
                  </Button>
                ) : null}
                <Button variant="outline" className="h-9" asChild>
                  <a href={directionsHref(p.latitude, p.longitude)} target="_blank" rel="noreferrer">
                    <Navigation aria-hidden /> Udhëzime në hartë
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-2xl font-semibold">{p.stats.availableCount}</p>
                  <p className="text-xs text-muted-foreground">barna të raportuara në dispozicion</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-2xl font-semibold">{p.stats.inventoryCount}</p>
                  <p className="text-xs text-muted-foreground">barna në inventarin e raportuar</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Orari i punës nuk publikohet në MediFind — konfirmoni me farmacinë.</p>
            </CardContent>
          </Card>
          <LazyPharmacyMap
            markers={[{ id: p.id, lat: p.latitude, lng: p.longitude, title: p.name, subtitle: `${p.address}, ${p.city}`, phone: p.phone }]}
            selectedId={p.id}
            className="h-72 w-full rounded-xl border lg:h-full lg:min-h-80"
          />
        </div>
      )}

      {p ? (
        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-lg">Inventari i raportuar</CardTitle>
            <ReportedNotice />
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="inv-q" className="sr-only">Kërko në inventar</label>
              <Input id="inv-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Kërko barin…" className="h-9 w-64" />
              <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
                <TabsList>
                  <TabsTrigger value="available">Në dispozicion</TabsTrigger>
                  <TabsTrigger value="all">Të gjitha</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {inventory.error ? (
              <ErrorState error={inventory.error} onRetry={inventory.reload} />
            ) : inventory.loading && !inventory.data ? (
              <ListSkeleton rows={3} />
            ) : inventory.data && inventory.data.items.length === 0 ? (
              <EmptyState icon={Package} title="Nuk ka barna për t’u shfaqur" description="Kjo farmaci nuk ka raportuar barna që përputhen me filtrin." />
            ) : inventory.data ? (
              <>
                <ul className="divide-y">
                  {inventory.data.items.map((row) => (
                    <li key={row.inventoryId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link href={`/medicines/${row.medicine.id}`} className="font-medium hover:text-primary hover:underline">
                          {row.medicine.name} {row.medicine.strength}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.medicine.dosageForm ? DOSAGE_FORM_LABELS[row.medicine.dosageForm] : ""}
                          {row.medicine.packageSize ? ` · ${row.medicine.packageSize}` : ""}
                          {" · "}përditësuar {timeAgo(row.lastReportedAt)}
                          {row.quantity !== null ? ` · ${row.quantity} copë` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <FreshnessBadge freshness={row.freshness} />
                        <StatusBadge status={row.availabilityStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
                <Pager meta={inventory.data.meta} onPage={setPage} />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
