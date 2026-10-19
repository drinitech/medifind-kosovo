export type Role = "USER" | "PHARMACY_MANAGER" | "ADMIN";
export type AvailabilityStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
export type Freshness = "FRESH" | "AGING" | "STALE";
export type InventorySource = "MANUAL" | "IMPORT" | "API" | "SCHEDULED_IMPORT" | "SEED";
export type DosageForm =
  | "TABLET"
  | "CAPSULE"
  | "SYRUP"
  | "SUSPENSION"
  | "SOLUTION"
  | "INJECTION"
  | "CREAM"
  | "OINTMENT"
  | "GEL"
  | "DROPS"
  | "SPRAY"
  | "INHALER"
  | "SUPPOSITORY"
  | "POWDER"
  | "PATCH"
  | "OTHER";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface Medicine {
  id: string;
  catalogCode: string | null;
  name: string;
  activeIngredient: string | null;
  strength: string | null;
  dosageForm: DosageForm | null;
  packageSize: string | null;
  manufacturer: string | null;
}

export interface MedicineSearchResult extends Medicine {
  availablePharmacyCount: number;
  latestReportAt: string | null;
}

export interface MedicineDetail extends Medicine {
  variants: Medicine[];
}

export type PharmacySource = "REGISTRATION" | "OSM" | "SEED";

export interface PharmacySummary {
  id: string;
  name: string;
  slug: string;
  /** Unknown for many OpenStreetMap listings. */
  address: string | null;
  city: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email?: string | null;
  isDemo: boolean;
  /** Verified pharmacies participate in MediFind and report inventory; others are directory listings. */
  isVerified?: boolean;
  dataSource?: PharmacySource;
  externalId?: string | null;
  distanceKm?: number;
}

export interface FreshnessThresholds {
  agingHours: number;
  staleHours: number;
}

export interface AvailabilityRow {
  inventoryId: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  lastReportedAt: string;
  source: InventorySource;
  freshness: Freshness;
  isReported: true;
  distanceKm: number | null;
  pharmacy: PharmacySummary;
}

export interface AvailabilityResponse extends Paginated<AvailabilityRow> {
  summary: { total: number; inStock: number; lowStock: number; outOfStock: number; stale: number };
  thresholds: FreshnessThresholds;
}

export interface PharmacyDetail extends PharmacySummary {
  verifiedAt: string | null;
  sourceUpdatedAt: string | null;
  /** null for directory listings, which report no inventory. */
  stats: { inventoryCount: number; availableCount: number; lastInventoryUpdate: string | null } | null;
}

export interface PublicInventoryRow {
  inventoryId: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  lastReportedAt: string;
  source: InventorySource;
  freshness: Freshness;
  medicine: Medicine;
}

export interface Membership {
  role: "OWNER" | "STAFF";
  pharmacy: { id: string; name: string; slug: string; city: string; isVerified: boolean; isActive: boolean };
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  memberships: Membership[];
  unreadNotifications: number;
}

export interface InventoryEntry {
  id: string;
  pharmacyId: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  showQuantityPublicly: boolean;
  isActive: boolean;
  lastReportedAt: string;
  source: InventorySource;
  createdAt: string;
  updatedAt: string;
  freshness: Freshness;
  medicine: Medicine & { isActive: boolean };
}

export interface InventoryStats {
  pharmacy: { id: string; name: string; isVerified: boolean; isActive: boolean };
  activeEntries: number;
  inactiveEntries: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  unknown: number;
  staleEntries: number;
  lastUpdate: string | null;
  thresholds: FreshnessThresholds;
}

export interface HistoryEntry {
  id: string;
  previousStatus: AvailabilityStatus | null;
  newStatus: AvailabilityStatus;
  previousQuantity: number | null;
  newQuantity: number | null;
  previousIsActive?: boolean | null;
  newIsActive: boolean;
  source: InventorySource;
  createdAt: string;
  changedBy: { id: string; fullName: string } | null;
  inventory: { id?: string; medicine: Pick<Medicine, "id" | "name" | "strength" | "dosageForm"> };
  pharmacy?: { id: string; name: string; city: string };
}

export interface ImportRowError {
  field: string;
  code: string;
  message: string;
  params?: Record<string, string | number>;
}

export interface ImportPreviewRow {
  rowNumber: number;
  input: { medicine: string; quantity: string; availabilityStatus: string };
  medicine?: Pick<Medicine, "id" | "name" | "strength" | "dosageForm">;
  availabilityStatus?: AvailabilityStatus;
  quantity?: number | null;
  showQuantityPublicly?: boolean;
  action?: "CREATE" | "UPDATE" | "UNCHANGED";
  errors: ImportRowError[];
}

export interface ImportPreview {
  batchId: string;
  fileName: string;
  expiresAt: string;
  columns: { mapping: Record<string, string | undefined>; unknownColumns: string[] };
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    creates: number;
    updates: number;
    unchanged: number;
    duplicates: number;
  };
  rows: ImportPreviewRow[];
}

export interface ImportResult {
  batchId: string;
  fileName: string;
  created: number;
  updated: number;
  unchanged: number;
  skippedRows: number[];
  errorRows: number;
}

export interface Alert {
  id: string;
  preferredCity: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  isActive: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  medicine: Medicine;
  currentlyAvailableCount: number;
}

export interface AppNotification {
  id: string;
  type: "AVAILABILITY_ALERT" | "PHARMACY_VERIFIED" | "SYSTEM";
  channel: "IN_APP" | "EMAIL";
  title: string;
  message: string;
  link: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface OwnPharmacy extends PharmacySummary {
  isActive: boolean;
  verifiedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}
