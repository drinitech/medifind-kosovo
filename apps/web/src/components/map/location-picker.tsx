"use client";

import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CITIES } from "@/lib/labels";

export interface ChosenLocation {
  lat: number;
  lng: number;
  label: string;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Lets people set a reference point for distance sorting — by browser
 * geolocation, by city, by address (OpenStreetMap Nominatim) or by clicking the
 * map. Location is optional: search works without it, and it is never stored.
 */
export function LocationPicker({ value, onChange }: { value: ChosenLocation | null; onChange: (loc: ChosenLocation | null) => void }) {
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      toast.error("Shfletuesi juaj nuk e mbështet vendndodhjen. Zgjidhni një qytet ose adresë.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Vendndodhja ime" });
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Qasja në vendndodhje u refuzua. Mund të zgjidhni një qytet, të shkruani adresën ose të klikoni në hartë."
            : "Vendndodhja nuk u gjet. Zgjidhni një qytet ose shkruani adresën.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function searchAddress(e: React.FormEvent) {
    e.preventDefault();
    const q = address.trim();
    if (q.length < 3) return;
    setGeocoding(true);
    setResults([]);
    try {
      // Bounded to Kosovo; used only on explicit submit to respect Nominatim's usage policy.
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=sq&bounded=1&viewbox=19.8,43.4,21.9,41.7&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GeocodeResult[];
      if (data.length === 0) toast.info("Adresa nuk u gjet. Provoni një emër rruge ose qyteti tjetër.");
      setResults(data);
    } catch {
      toast.error("Kërkimi i adresës nuk funksionoi tani. Zgjidhni një qytet ose klikoni në hartë.");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={locateMe} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" aria-hidden /> : <Crosshair aria-hidden />}
          Përdor vendndodhjen time
        </Button>
        <Select
          value={CITIES.find((c) => c.name === value?.label)?.name ?? ""}
          onValueChange={(name) => {
            const c = CITIES.find((x) => x.name === name);
            if (c) onChange({ lat: c.lat, lng: c.lng, label: c.name });
          }}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Zgjidh qytetin">
            <SelectValue placeholder="Zgjidh qytetin" />
          </SelectTrigger>
          <SelectContent>
            {CITIES.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
            <MapPin className="size-3.5" aria-hidden />
            <span className="max-w-48 truncate">{value.label}</span>
            <button type="button" className="ml-1 rounded-full p-0.5 hover:bg-primary/10" onClick={() => onChange(null)} aria-label="Hiq vendndodhjen">
              <X className="size-3.5" />
            </button>
          </span>
        ) : null}
      </div>
      <form onSubmit={searchAddress} className="flex gap-2">
        <label htmlFor="address-search" className="sr-only">
          Shkruani një adresë
        </label>
        <Input
          id="address-search"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="ose shkruani adresën, p.sh. Rruga Agim Ramadani, Prishtinë"
          className="h-9"
        />
        <Button type="submit" variant="secondary" className="h-9" disabled={geocoding || address.trim().length < 3}>
          {geocoding ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          <span className="sr-only sm:not-sr-only">Gjej</span>
        </Button>
      </form>
      {results.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card text-sm" aria-label="Rezultatet e adresës">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent"
                onClick={() => {
                  onChange({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name.split(",").slice(0, 2).join(",") });
                  setResults([]);
                  setAddress("");
                }}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">Mund të klikoni edhe në hartë për të zgjedhur pikën. Vendndodhja nuk ruhet.</p>
    </div>
  );
}
