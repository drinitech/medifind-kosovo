"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Pill, Plus, Power, PowerOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { DOSAGE_FORM_LABELS } from "@/lib/labels";
import type { DosageForm, Medicine, Paginated } from "@/lib/types";

interface AdminMedicine extends Medicine {
  isActive: boolean;
  _count: { inventory: number; alerts: number };
}

const NONE = "__none";

export default function AdminMedicinesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminMedicine | null>(null);
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi<Paginated<AdminMedicine>>("/admin/medicines", { q: q.trim() || undefined, status, page, pageSize: 20 });

  async function setActive(m: AdminMedicine, isActive: boolean) {
    try {
      await api(`/admin/medicines/${m.id}`, { method: "PATCH", body: { isActive } });
      toast.success(isActive ? "Bari u riaktivizua." : "Bari u çaktivizua.");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Katalogu i barnave"
        description="Çdo kombinim emri, doze, forme dhe paketimi është produkt më vete. Katalogu mund të mos jetë i plotë."
        actions={<Button className="h-9" onClick={() => { setEditing(null); setOpen(true); }}><Plus aria-hidden /> Shto bar</Button>}
      />
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap gap-2 border-b p-3">
          <label htmlFor="med-q" className="sr-only">Kërko</label>
          <Input id="med-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Emri, përbërësi ose kodi…" className="h-9 w-72" />
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="h-9 w-40" aria-label="Statusi"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Të gjitha</SelectItem>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="inactive">Joaktive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data && loading ? (
          <ListSkeleton className="p-4" />
        ) : data && data.items.length === 0 ? (
          <div className="p-4"><EmptyState icon={Pill} title="Nuk u gjet asnjë bar" /></div>
        ) : data ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bari</TableHead>
                  <TableHead>Përbërësi aktiv</TableHead>
                  <TableHead>Paketimi</TableHead>
                  <TableHead>Kodi</TableHead>
                  <TableHead className="text-right">Farmaci</TableHead>
                  <TableHead><span className="sr-only">Veprime</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((m) => (
                  <TableRow key={m.id} className={!m.isActive ? "opacity-60" : undefined}>
                    <TableCell>
                      <p className="font-medium">{m.name} {m.strength}</p>
                      <p className="text-xs text-muted-foreground">{m.dosageForm ? DOSAGE_FORM_LABELS[m.dosageForm] : "Formë e pa specifikuar"}</p>
                      {!m.isActive ? <Badge variant="outline" className="mt-1">Joaktiv</Badge> : null}
                    </TableCell>
                    <TableCell>{m.activeIngredient ?? "—"}</TableCell>
                    <TableCell>{m.packageSize ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.catalogCode ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m._count.inventory}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Ndrysho ${m.name}`} onClick={() => { setEditing(m); setOpen(true); }}><Pencil /></Button>
                        {m.isActive ? (
                          <ConfirmDialog
                            destructive
                            title="Çaktivizo barin?"
                            description={`${m.name} ${m.strength ?? ""} do të hiqet nga kërkimet publike dhe nuk mund të shtohet në inventarë të rinj. ${m._count.inventory} regjistrime inventari dhe ${m._count.alerts} alarme aktive ruhen.`}
                            confirmLabel="Çaktivizo"
                            onConfirm={() => setActive(m, false)}
                            trigger={<Button variant="ghost" size="icon" aria-label={`Çaktivizo ${m.name}`}><PowerOff className="text-destructive" /></Button>}
                          />
                        ) : (
                          <Button variant="ghost" size="icon" aria-label={`Riaktivizo ${m.name}`} onClick={() => setActive(m, true)}><Power /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <div className="px-4 pb-3"><Pager meta={data?.meta} onPage={setPage} /></div>
      </Card>
      <MedicineDialog open={open} onOpenChange={setOpen} medicine={editing} onSaved={reload} />
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, "Shkruani emrin").max(150),
  activeIngredient: z.string().trim().max(200),
  strength: z.string().trim().max(50),
  dosageForm: z.string(),
  packageSize: z.string().trim().max(50),
  manufacturer: z.string().trim().max(150),
  catalogCode: z.string().trim().max(50),
});
type Values = z.infer<typeof schema>;

function MedicineDialog({ open, onOpenChange, medicine, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; medicine: AdminMedicine | null; onSaved: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: medicine?.name ?? "",
      activeIngredient: medicine?.activeIngredient ?? "",
      strength: medicine?.strength ?? "",
      dosageForm: medicine?.dosageForm ?? NONE,
      packageSize: medicine?.packageSize ?? "",
      manufacturer: medicine?.manufacturer ?? "",
      catalogCode: medicine?.catalogCode ?? "",
    });
  }, [open, medicine, form]);

  async function onSubmit(v: Values) {
    const body = { ...v, dosageForm: v.dosageForm === NONE ? undefined : v.dosageForm };
    try {
      if (medicine) await api(`/admin/medicines/${medicine.id}`, { method: "PATCH", body });
      else await api("/admin/medicines", { method: "POST", body });
      toast.success(medicine ? "Bari u përditësua." : "Bari u shtua në katalog.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{medicine ? "Ndrysho barin" : "Shto bar në katalog"}</DialogTitle>
          <DialogDescription>Plotësoni vetëm të dhënat që i dini me siguri. Fushat opsionale mund të lihen bosh.</DialogDescription>
        </DialogHeader>
        <form id="medicine-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="m-name">Emri *</Label>
            <Input id="m-name" aria-invalid={!!errors.name} {...form.register("name")} />
            {errors.name ? <p className="text-sm text-destructive" role="alert">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-ingredient">Përbërësi aktiv</Label>
            <Input id="m-ingredient" {...form.register("activeIngredient")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-strength">Doza</Label>
            <Input id="m-strength" placeholder="p.sh. 500 mg" {...form.register("strength")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-form">Forma</Label>
            <Controller
              control={form.control}
              name="dosageForm"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="m-form" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>E pa specifikuar</SelectItem>
                    {(Object.keys(DOSAGE_FORM_LABELS) as DosageForm[]).map((f) => (
                      <SelectItem key={f} value={f}>{DOSAGE_FORM_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-pack">Paketimi</Label>
            <Input id="m-pack" placeholder="p.sh. 20 tableta" {...form.register("packageSize")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-man">Prodhuesi</Label>
            <Input id="m-man" {...form.register("manufacturer")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-code">Kodi i katalogut</Label>
            <Input id="m-code" placeholder="përdoret në importe" {...form.register("catalogCode")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulo</Button>
          <Button type="submit" form="medicine-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Ruaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
