"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/types";

export function Pager({ meta, onPage }: { meta: PageMeta | undefined; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Faqosja">
      <p className="text-sm text-muted-foreground">
        {from}–{to} nga {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeft aria-hidden />
          Para
        </Button>
        <span className="text-sm tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Pas
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
