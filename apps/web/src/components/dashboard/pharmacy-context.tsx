"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Membership } from "@/lib/types";

interface PharmacyContextValue {
  /** Pharmacy the dashboard currently acts on, or null when the manager has none yet. */
  pharmacyId: string | null;
  membership: Membership | null;
  memberships: Membership[];
  setPharmacyId: (id: string) => void;
}

const PharmacyContext = createContext<PharmacyContextValue | null>(null);
const STORAGE_KEY = "medifind.activePharmacy";
const CHANGE_EVENT = "medifind:active-pharmacy";

function readPreferred(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage unavailable — fall back to the first membership
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function PharmacyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const memberships = useMemo(() => user?.memberships ?? [], [user]);
  const preferred = useSyncExternalStore(subscribe, readPreferred, () => null);

  const membership = memberships.find((m) => m.pharmacy.id === preferred) ?? memberships[0] ?? null;
  const value = useMemo<PharmacyContextValue>(
    () => ({
      pharmacyId: membership?.pharmacy.id ?? null,
      membership,
      memberships,
      setPharmacyId: (id) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, id);
        } catch {
          // ignore — the choice just won't persist
        }
        window.dispatchEvent(new Event(CHANGE_EVENT));
      },
    }),
    [membership, memberships],
  );
  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>;
}

export function usePharmacy() {
  const ctx = useContext(PharmacyContext);
  if (!ctx) throw new Error("usePharmacy must be used inside <PharmacyProvider>");
  return ctx;
}

export function PharmacySwitcher() {
  const { memberships, pharmacyId, setPharmacyId } = usePharmacy();
  if (memberships.length < 2) return null;
  return (
    <div className="mb-3 px-1">
      <label htmlFor="pharmacy-switch" className="sr-only">
        Farmacia aktive
      </label>
      <Select value={pharmacyId ?? undefined} onValueChange={setPharmacyId}>
        <SelectTrigger id="pharmacy-switch" className="h-9 w-full">
          <SelectValue placeholder="Zgjidh farmacinë" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((m) => (
            <SelectItem key={m.pharmacy.id} value={m.pharmacy.id}>
              {m.pharmacy.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
