import type { AvailabilityStatus, DosageForm, Freshness, InventorySource, Role } from "./types";

export const REPORTED_NOTICE = "Disponueshmëria e raportuar — kontakto farmacinë për konfirmim.";

export const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  IN_STOCK: "Në dispozicion",
  LOW_STOCK: "Sasi e ulët",
  OUT_OF_STOCK: "Nuk ka",
  UNKNOWN: "E panjohur",
};

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  FRESH: "Përditësuar së fundi",
  AGING: "Jo shumë e re",
  STALE: "E vjetruar",
};

export const FRESHNESS_HINTS: Record<Freshness, string> = {
  FRESH: "Raportuar brenda ditës së fundit.",
  AGING: "Raporti ka disa ditë — mund të ketë ndryshuar.",
  STALE: "Raporti është i vjetër dhe mund të mos jetë më i saktë.",
};

export const DOSAGE_FORM_LABELS: Record<DosageForm, string> = {
  TABLET: "Tableta",
  CAPSULE: "Kapsula",
  SYRUP: "Shurup",
  SUSPENSION: "Suspension",
  SOLUTION: "Tretësirë",
  INJECTION: "Injeksion",
  CREAM: "Krem",
  OINTMENT: "Pomadë",
  GEL: "Xhel",
  DROPS: "Pika",
  SPRAY: "Sprej",
  INHALER: "Inhalator",
  SUPPOSITORY: "Supozitorë",
  POWDER: "Pluhur",
  PATCH: "Flaster",
  OTHER: "Tjetër",
};

export const SOURCE_LABELS: Record<InventorySource, string> = {
  MANUAL: "Manual",
  IMPORT: "Import skedari",
  API: "Integrim API",
  SCHEDULED_IMPORT: "Import i planifikuar",
  SEED: "Të dhëna demo",
};

export const ROLE_LABELS: Record<Role, string> = {
  USER: "Përdorues",
  PHARMACY_MANAGER: "Menaxher farmacie",
  ADMIN: "Administrator",
};

export const IMPORT_ERROR_LABELS: Record<string, (p?: Record<string, string | number>) => string> = {
  MISSING_MEDICINE_IDENTIFIER: () => "Mungon kodi, ID-ja ose emri i barit",
  MEDICINE_NOT_FOUND: (p) => `Bari “${p?.value ?? ""}” nuk u gjet në katalog`,
  MEDICINE_AMBIGUOUS: (p) => `“${p?.value ?? ""}” përputhet me ${p?.count ?? "disa"} produkte — shtoni dozën dhe formën ose përdorni kodin`,
  MEDICINE_INACTIVE: () => "Ky bar nuk është më aktiv në katalog",
  INVALID_QUANTITY: (p) => `Sasi e pavlefshme “${p?.value ?? ""}” — duhet numër i plotë ≥ 0`,
  INVALID_STATUS: (p) => `Status i panjohur “${p?.value ?? ""}”`,
  INVALID_DOSAGE_FORM: (p) => `Formë e panjohur “${p?.value ?? ""}”`,
  INVALID_BOOLEAN: (p) => `Vlerë e pavlefshme “${p?.value ?? ""}” — përdorni po/jo`,
  MISSING_AVAILABILITY: () => "Jepni sasinë ose statusin e disponueshmërisë",
  STATUS_QUANTITY_MISMATCH: () => "Statusi nuk përputhet me sasinë",
  DUPLICATE_ROW: (p) => `Rresht i dyfishtë — i njëjti bar në rreshtin ${p?.firstRow ?? ""}`,
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.register": "Regjistrim përdoruesi",
  "user.update": "Ndryshim përdoruesi",
  "pharmacy.create": "Regjistrim farmacie",
  "pharmacy.update": "Ndryshim profili farmacie",
  "pharmacy.verify": "Verifikim farmacie",
  "pharmacy.unverify": "Heqje verifikimi",
  "pharmacy.deactivate": "Çaktivizim farmacie",
  "pharmacy.member_add": "Shtim menaxheri",
  "pharmacy.member_remove": "Heqje menaxheri",
  "medicine.create": "Shtim bari",
  "medicine.update": "Ndryshim bari",
  "medicine.deactivate": "Çaktivizim bari",
  "inventory.create": "Shtim në inventar",
  "inventory.update": "Përditësim inventari",
  "inventory.deactivate": "Çaktivizim inventari",
  "inventory.bulk_update": "Përditësim në grup",
  "inventory.import": "Import inventari",
  "system.seed": "Të dhëna demo",
};

export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Prishtinë", lat: 42.6629, lng: 21.1655 },
  { name: "Prizren", lat: 42.2139, lng: 20.7397 },
  { name: "Pejë", lat: 42.6593, lng: 20.2883 },
  { name: "Gjakovë", lat: 42.3803, lng: 20.4308 },
  { name: "Ferizaj", lat: 42.3702, lng: 21.1553 },
  { name: "Gjilan", lat: 42.4635, lng: 21.4694 },
  { name: "Mitrovicë", lat: 42.8914, lng: 20.866 },
  { name: "Podujevë", lat: 42.9106, lng: 21.1931 },
  { name: "Vushtrri", lat: 42.8231, lng: 20.9675 },
  { name: "Suharekë", lat: 42.3589, lng: 20.8253 },
];

export const KOSOVO_CENTER: [number, number] = [42.6, 20.9];

export function medicineLabel(m: { name: string; strength: string | null; dosageForm: DosageForm | null }) {
  return [m.name, m.strength, m.dosageForm ? DOSAGE_FORM_LABELS[m.dosageForm].toLowerCase() : null]
    .filter(Boolean)
    .join(" · ");
}
