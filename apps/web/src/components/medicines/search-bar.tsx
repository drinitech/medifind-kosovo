"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Medicine search with accessible autocomplete (ARIA combobox pattern). */
export function SearchBar({ size = "lg", className }: { size?: "lg" | "md"; className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the input in sync when the URL query changes (e.g. clicking a popular search).
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setValue(initial);
  }

  const trimmed = value.trim();
  const wantsSuggestions = trimmed.length >= 2 && trimmed !== initial;
  const visible = wantsSuggestions ? suggestions : [];
  const showList = open && visible.length > 0;

  useEffect(() => {
    if (!wantsSuggestions) return;
    const q = trimmed;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<string[]>("/medicines/suggestions", { query: { q }, signal: controller.signal })
        .then((s) => {
          setSuggestions(s);
          setActive(-1);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, wantsSuggestions]);

  function submit(q: string) {
    const term = q.trim();
    setOpen(false);
    if (!term) return;
    const next = new URLSearchParams(params.toString());
    next.set("q", term);
    next.delete("page");
    router.push(`/?${next.toString()}#rezultatet`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visible.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      setValue(visible[active]);
      submit(visible[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }


  return (
    <form
      role="search"
      className={cn("relative w-full", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Kërko barin sipas emrit ose përbërësit aktiv
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-card shadow-sm transition-shadow focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
          size === "lg" ? "p-2 pl-4" : "p-1.5 pl-3",
        )}
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder="p.sh. Paracetamol 500 mg, Ibuprofen, Amoxicillin…"
          className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground", size === "lg" ? "h-11 text-base" : "h-9 text-sm")}
          maxLength={100}
        />
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        <Button type="submit" className={cn(size === "lg" ? "h-11 rounded-xl px-5 text-base" : "h-9 rounded-lg")}>
          Kërko
        </Button>
      </div>
      {showList ? (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-xl border bg-popover py-1 shadow-lg">
          {visible.map((s, i) => (
            <li
              key={s}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer px-4 py-2 text-sm", i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
              onMouseDown={(e) => {
                e.preventDefault();
                clearTimeout(blurTimer.current);
                setValue(s);
                submit(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
