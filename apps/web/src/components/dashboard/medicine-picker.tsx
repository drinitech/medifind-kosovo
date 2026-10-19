"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { medicineLabel } from "@/lib/labels";
import type { Medicine, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Server-side searchable picker for catalog medicines. */
export function MedicinePicker({ value, onChange, invalid }: { value: Medicine | null; onChange: (m: Medicine) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<Paginated<Medicine>>("/medicines", { query: { q: query.trim() || undefined, pageSize: 20, sort: query.trim() ? "relevance" : "name" }, signal: controller.signal })
        .then((r) => setItems(r.items))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn("h-10 w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value ? medicineLabel(value) : "Kërkoni barin në katalog…"}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Emri, përbërësi ose doza…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Duke kërkuar…
              </div>
            ) : (
              <CommandEmpty>Nuk u gjet. Kontaktoni administratorin nëse bari mungon në katalog.</CommandEmpty>
            )}
            <CommandGroup>
              {items.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value?.id === m.id ? "opacity-100" : "opacity-0")} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate">{medicineLabel(m)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.packageSize, m.catalogCode].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
