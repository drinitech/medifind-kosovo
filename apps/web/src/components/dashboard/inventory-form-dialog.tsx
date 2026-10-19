"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, errorMessage } from "@/lib/api";
import { medicineLabel, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, InventoryEntry, Medicine } from "@/lib/types";
import { MedicinePicker } from "./medicine-picker";

const AUTO = "AUTO";

const schema = z
  .object({
    status: z.enum(["AUTO", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "UNKNOWN"]),
    quantity: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 1_000_000), "Numër i plotë nga 0 deri në 1 000 000"),
    showQuantityPublicly: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.status === AUTO && v.quantity === "") {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Shkruani sasinë ose zgjidhni statusin" });
    }
    const q = v.quantity === "" ? null : Number(v.quantity);
    if (v.status === "OUT_OF_STOCK" && q !== null && q > 0) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "“Nuk ka” nuk mund të ketë sasi mbi 0" });
    }
    if ((v.status === "IN_STOCK" || v.status === "LOW_STOCK") && q === 0) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "Me sasi 0 statusi duhet të jetë “Nuk ka”" });
    }
  });

type Values = z.infer<typeof schema>;

/** Mirrors the API's quantity → status rule (0 none, 1–5 low, more = in stock). */
function derivedStatus(quantity: number | null): AvailabilityStatus {
  if (quantity === null) return "UNKNOWN";
  if (quantity <= 0) return "OUT_OF_STOCK";
  return quantity <= 5 ? "LOW_STOCK" : "IN_STOCK";
}

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Present when editing an existing entry. */
  entry?: InventoryEntry | null;
  pharmacyId: string;
  onSaved: () => void;
}

export function InventoryFormDialog(props: DialogProps) {
  const { open, onOpenChange, entry } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Përditëso disponueshmërinë" : "Shto bar në inventar"}</DialogTitle>
          <DialogDescription>
            {entry ? medicineLabel(entry.medicine) : "Çdo bar (me dozën dhe formën e vet) shtohet vetëm një herë."} Ruajtja e regjistron si raport të ri me orën aktuale.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted fresh on every open, so the form always starts from the current entry. */}
        {open ? <InventoryForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function InventoryForm({ onOpenChange, entry, pharmacyId, onSaved }: DialogProps) {
  const [medicine, setMedicine] = useState<Medicine | null>(entry?.medicine ?? null);
  const [medicineError, setMedicineError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Entries whose status simply follows the quantity stay "automatic", so updating the quantity is enough.
      status: entry && entry.availabilityStatus !== derivedStatus(entry.quantity) ? entry.availabilityStatus : AUTO,
      quantity: entry?.quantity !== null && entry?.quantity !== undefined ? String(entry.quantity) : "",
      showQuantityPublicly: entry?.showQuantityPublicly ?? false,
    },
  });

  async function onSubmit(values: Values) {
    if (!entry && !medicine) {
      setMedicineError("Zgjidhni barin");
      return;
    }
    const quantity = values.quantity === "" ? null : Number(values.quantity);
    const availabilityStatus = values.status === AUTO ? undefined : (values.status as AvailabilityStatus);
    try {
      if (entry) {
        await api(`/pharmacy/inventory/${entry.id}`, {
          method: "PATCH",
          body: { availabilityStatus, quantity, showQuantityPublicly: values.showQuantityPublicly },
        });
        toast.success("Inventari u përditësua.");
      } else {
        await api("/pharmacy/inventory", {
          method: "POST",
          query: { pharmacyId },
          body: { medicineId: medicine!.id, availabilityStatus, quantity, showQuantityPublicly: values.showQuantityPublicly },
        });
        toast.success("Bari u shtua në inventar.");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_INVENTORY") setMedicineError(errorMessage(err));
      else toast.error(errorMessage(err));
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <>
      <form id="inventory-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {!entry ? (
          <div className="space-y-1.5">
            <Label>Bari</Label>
            <MedicinePicker value={medicine} onChange={(m) => { setMedicine(m); setMedicineError(null); }} invalid={!!medicineError} />
            {medicineError ? <p className="text-sm text-destructive" role="alert">{medicineError}</p> : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-qty">Sasia</Label>
            <Input id="inv-qty" inputMode="numeric" placeholder="p.sh. 24" className="h-10" aria-invalid={!!errors.quantity} {...form.register("quantity")} />
            {errors.quantity ? <p className="text-sm text-destructive" role="alert">{errors.quantity.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-status">Statusi</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="inv-status" className="h-10 w-full" aria-invalid={!!errors.status}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>Automatik nga sasia</SelectItem>
                    {(Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status ? <p className="text-sm text-destructive" role="alert">{errors.status.message}</p> : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Automatik: 0 = Nuk ka, 1–5 = Sasi e ulët, mbi 5 = Në dispozicion.</p>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label htmlFor="inv-public">Shfaq sasinë publikisht</Label>
            <p className="text-xs text-muted-foreground">Nëse çaktivizohet, publiku sheh vetëm statusin.</p>
          </div>
          <Controller
            control={form.control}
            name="showQuantityPublicly"
            render={({ field }) => <Switch id="inv-public" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Anulo</Button>
        <Button type="submit" form="inventory-form" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Ruaj
        </Button>
      </DialogFooter>
    </>
  );
}
