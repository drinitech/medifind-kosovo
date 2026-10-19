"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LazyPharmacyMap } from "@/components/map/lazy-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { CITIES } from "@/lib/labels";
import type { OwnPharmacy } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Shkruani emrin e farmacisë").max(120),
  address: z.string().trim().min(3, "Shkruani adresën").max(200),
  city: z.string().trim().min(2, "Zgjidhni qytetin").max(80),
  latitude: z.number({ message: "Zgjidhni vendndodhjen në hartë" }).min(41.7).max(43.4),
  longitude: z.number({ message: "Zgjidhni vendndodhjen në hartë" }).min(19.8).max(21.9),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{6,20}$/.test(v), "Numër telefoni i pavlefshëm"),
  email: z.union([z.literal(""), z.string().trim().email("Email i pavlefshëm")]),
});

type Values = z.infer<typeof schema>;

export function PharmacyProfileForm({
  initial,
  pharmacyId,
  onSaved,
}: {
  initial?: OwnPharmacy | null;
  pharmacyId?: string | null;
  onSaved: (p: OwnPharmacy) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      city: initial?.city ?? "",
      latitude: initial?.latitude,
      longitude: initial?.longitude,
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
    },
  });
  const lat = form.watch("latitude");
  const lng = form.watch("longitude");
  const city = form.watch("city");
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const body = { ...values, phone: values.phone || undefined, email: values.email || undefined };
    try {
      const saved = initial
        ? await api<OwnPharmacy>("/pharmacy/profile", { method: "PATCH", body, query: { pharmacyId } })
        : await api<OwnPharmacy>("/pharmacy/profile", { method: "POST", body });
      toast.success(initial ? "Profili u ruajt." : "Farmacia u regjistrua dhe pret verifikimin.");
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2" noValidate>
      <div className="space-y-4">
        <FormField id="ph-name" label="Emri i farmacisë" error={errors.name?.message}>
          <Input id="ph-name" className="h-10" aria-invalid={!!errors.name} {...form.register("name")} />
        </FormField>
        <FormField id="ph-address" label="Adresa" error={errors.address?.message}>
          <Input id="ph-address" className="h-10" aria-invalid={!!errors.address} {...form.register("address")} />
        </FormField>
        <FormField id="ph-city" label="Qyteti" error={errors.city?.message}>
          <Select
            value={CITIES.some((c) => c.name === city) ? city : city ? "__other" : ""}
            onValueChange={(v) => {
              const c = CITIES.find((x) => x.name === v);
              if (!c) return;
              form.setValue("city", c.name, { shouldValidate: true });
              if (lat === undefined) {
                form.setValue("latitude", c.lat, { shouldValidate: true });
                form.setValue("longitude", c.lng, { shouldValidate: true });
              }
            }}
          >
            <SelectTrigger id="ph-city" className="h-10 w-full" aria-invalid={!!errors.city}>
              <SelectValue placeholder="Zgjidhni qytetin" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
              {city && !CITIES.some((c) => c.name === city) ? <SelectItem value="__other">{city}</SelectItem> : null}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="ph-phone" label="Telefoni publik (opsional)" error={errors.phone?.message}>
            <Input id="ph-phone" type="tel" className="h-10" placeholder="+383 …" aria-invalid={!!errors.phone} {...form.register("phone")} />
          </FormField>
          <FormField id="ph-email" label="Email publik (opsional)" error={errors.email?.message}>
            <Input id="ph-email" type="email" className="h-10" aria-invalid={!!errors.email} {...form.register("email")} />
          </FormField>
        </div>
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {initial ? "Ruaj ndryshimet" : "Regjistro farmacinë"}
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Vendndodhja në hartë</Label>
        <LazyPharmacyMap
          markers={lat !== undefined && lng !== undefined ? [{ id: "self", lat, lng, title: form.getValues("name") || "Farmacia" }] : []}
          onPickLocation={(la, ln) => {
            form.setValue("latitude", Number(la.toFixed(6)), { shouldValidate: true });
            form.setValue("longitude", Number(ln.toFixed(6)), { shouldValidate: true });
          }}
          className="h-72 w-full rounded-xl border"
        />
        <p className="text-xs text-muted-foreground">
          Klikoni në hartë mbi hyrjen e farmacisë.{" "}
          {lat !== undefined && lng !== undefined ? `Koordinatat: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : ""}
        </p>
        {errors.latitude || errors.longitude ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.latitude?.message ?? errors.longitude?.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function FormField({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
