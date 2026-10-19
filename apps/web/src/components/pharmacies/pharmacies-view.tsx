"use client";

import { Building2, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Pager } from "@/components/common/pager";
import { DemoBadge, ParticipationBadge } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { LazyPharmacyMap, type MapMarker } from "@/components/map/lazy-map";
import { type ChosenLocation, LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { km, telHref, placeLabel } from "@/lib/format";
import type { Paginated, PharmacySummary } from "@/lib/types";

const ALL = "__all";

export function PharmaciesView() {
  const [location, setLocation] = useState<ChosenLocation | null>(null);
  const [radius, setRadius] = useState("10");
  const [city, setCity] = useState(ALL);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [participatingOnly, setParticipatingOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const cities = useApi<{ city: string; pharmacyCount: number }[]>("/pharmacies/cities");
  const nearby = useApi<PharmacySummary[]>(location ? "/pharmacies/nearby" : null, {
    lat: location?.lat,
    lng: location?.lng,
    radiusKm: Number(radius),
    limit: 100,
  });
  const list = useApi<Paginated<PharmacySummary>>(location ? null : "/pharmacies", {
    q: q.trim() || undefined,
    city: city === ALL ? undefined : city,
    participating: participatingOnly || undefined,
    page,
    pageSize: 12,
  });

  const items = location ? nearby.data?.filter((p) => !participatingOnly || p.isVerified) : list.data?.items;
  const state = location ? nearby : list;
  const markers = useMemo<MapMarker[]>(
    () =>
      (items ?? []).map((p) => ({
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
        title: p.name,
        subtitle: placeLabel(p),
        href: `/pharmacies/${p.slug}`,
        phone: p.phone,
        listing: !p.isVerified,
      })),
    [items],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Farmacitë"
        description="Farmacitë në Kosovë. Ato që raportojnë inventar shfaqen të parat; të tjerat vijnë nga OpenStreetMap dhe nuk kanë të dhëna për barnat."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-4">
          <Card className="gap-4 p-4">
            <LocationPicker value={location} onChange={(l) => { setLocation(l); setSelected(null); }} />
            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              {location ? (
                <div className="space-y-1">
                  <Label htmlFor="ph-radius" className="text-xs text-muted-foreground">Brenda</Label>
                  <Select value={radius} onValueChange={setRadius}>
                    <SelectTrigger id="ph-radius" className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["2", "5", "10", "25", "50", "100"].map((r) => (
                        <SelectItem key={r} value={r}>{r} km</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="ph-q" className="text-xs text-muted-foreground">Kërko</Label>
                    <Input id="ph-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Emri ose adresa" className="h-9 w-56" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ph-city" className="text-xs text-muted-foreground">Qyteti</Label>
                    <Select value={city} onValueChange={(v) => { setCity(v); setPage(1); }}>
                      <SelectTrigger id="ph-city" className="h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Të gjitha qytetet</SelectItem>
                        {(cities.data ?? []).map((c) => (
                          <SelectItem key={c.city} value={c.city}>
                            {c.city} ({c.pharmacyCount})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="flex h-9 items-center gap-2">
                <Switch id="ph-participating" checked={participatingOnly} onCheckedChange={(c) => { setParticipatingOnly(c); setPage(1); }} />
                <Label htmlFor="ph-participating" className="text-sm font-normal">Vetëm ato që raportojnë inventar</Label>
              </div>
            </div>
          </Card>

          {state.error ? (
            <ErrorState error={state.error} onRetry={state.reload} />
          ) : state.loading && !items ? (
            <ListSkeleton rows={4} />
          ) : items && items.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nuk u gjet asnjë farmaci"
              description={location ? "Asnjë farmaci brenda kësaj distance. Provoni një rreze më të madhe." : "Provoni një kërkim ose qytet tjetër."}
            />
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2">
                {(items ?? []).map((p) => (
                  <li key={p.id}>
                    <Card className={`h-full gap-2 p-4 ${selected === p.id ? "ring-2 ring-primary/40" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/pharmacies/${p.slug}`} className="font-semibold hover:text-primary hover:underline">
                          {p.name}
                        </Link>
                        {p.isDemo ? <DemoBadge /> : <ParticipationBadge verified={p.isVerified} className="shrink-0" />}
                      </div>
                      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          {placeLabel(p)}
                          {p.distanceKm !== undefined ? <strong className="ml-1 font-medium text-foreground">· {km(p.distanceKm)}</strong> : null}
                        </span>
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        {p.phone ? (
                          <Button size="sm" variant="outline" className="h-8" asChild>
                            <a href={telHref(p.phone)}><Phone aria-hidden /> {p.phone}</a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => {
                            setSelected(p.id);
                            mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                        >
                          <MapPin aria-hidden /> Në hartë
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              {!location ? <Pager meta={list.data?.meta} onPage={setPage} /> : null}
            </>
          )}
        </div>
        <div ref={mapRef} className="lg:sticky lg:top-20 lg:self-start">
          <LazyPharmacyMap
            markers={markers}
            selectedId={selected}
            userLocation={location}
            onSelect={setSelected}
            onPickLocation={(lat, lng) => setLocation({ lat, lng, label: "Pika në hartë" })}
            className="h-80 w-full rounded-xl border lg:h-[600px]"
          />
        </div>
      </div>
    </div>
  );
}
