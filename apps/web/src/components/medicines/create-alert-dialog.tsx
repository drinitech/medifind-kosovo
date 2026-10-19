"use client";

import { BellPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import type { ChosenLocation } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { CITIES, medicineLabel } from "@/lib/labels";
import type { Alert, Medicine } from "@/lib/types";

type Scope = "anywhere" | "city" | "radius";

export function CreateAlertDialog({ medicine, location }: { medicine: Medicine; location: ChosenLocation | null }) {
  const { user, refresh } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(location ? "radius" : "anywhere");
  const [city, setCity] = useState(CITIES[0].name);
  const [radius, setRadius] = useState("10");
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <Button variant="outline" className="h-10" asChild>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
          <BellPlus aria-hidden /> Kyçu për të marrë njoftim
        </Link>
      </Button>
    );
  }

  async function save() {
    setSaving(true);
    try {
      const body =
        scope === "city"
          ? { medicineId: medicine.id, preferredCity: city }
          : scope === "radius" && location
            ? { medicineId: medicine.id, latitude: location.lat, longitude: location.lng, radiusKm: Number(radius) }
            : { medicineId: medicine.id };
      const alert = await api<Alert>("/alerts", { method: "POST", body });
      toast.success(
        alert.currentlyAvailableCount > 0
          ? `Alarmi u krijua. ${alert.currentlyAvailableCount} farmaci e raportojnë tashmë në dispozicion.`
          : "Alarmi u krijua. Do t’ju njoftojmë kur një farmaci ta raportojë në dispozicion.",
      );
      setOpen(false);
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <BellPlus aria-hidden /> Më njofto kur të jetë në dispozicion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alarm disponueshmërie</DialogTitle>
          <DialogDescription>
            Do të merrni një njoftim në aplikacion kur një farmaci e verifikuar raporton se{" "}
            <strong>{medicineLabel(medicine)}</strong> është në dispozicion.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="gap-3">
          <div className="flex items-center gap-3">
            <RadioGroupItem value="anywhere" id="scope-anywhere" />
            <Label htmlFor="scope-anywhere">Kudo në Kosovë</Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RadioGroupItem value="city" id="scope-city" />
            <Label htmlFor="scope-city">Vetëm në qytetin</Label>
            <Select value={city} onValueChange={setCity} disabled={scope !== "city"}>
              <SelectTrigger className="h-8 w-40" aria-label="Qyteti">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RadioGroupItem value="radius" id="scope-radius" disabled={!location} />
            <Label htmlFor="scope-radius" className={!location ? "text-muted-foreground" : undefined}>
              Brenda
            </Label>
            <Select value={radius} onValueChange={setRadius} disabled={scope !== "radius" || !location}>
              <SelectTrigger className="h-8 w-24" aria-label="Rrezja">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2", "5", "10", "25", "50"].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {location ? `nga ${location.label}` : "(zgjidhni fillimisht një vendndodhje në faqe)"}
            </span>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Ruajmë vetëm barin dhe preferencën e vendndodhjes për këtë alarm. Mund ta çaktivizoni në çdo kohë.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anulo
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Krijo alarmin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
