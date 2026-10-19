import { format, formatDistanceToNowStrict } from "date-fns";
import { sq } from "date-fns/locale";

/** "para 3 orësh" */
export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNowStrict(new Date(date), { locale: sq, addSuffix: true });
}

/** "19.10.2026, 14:05" */
export function dateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd.MM.yyyy, HH:mm");
}

export function dateOnly(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd.MM.yyyy");
}

export function km(distance: number | null | undefined): string {
  if (distance === null || distance === undefined) return "";
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toLocaleString("sq-AL", { maximumFractionDigits: 1 })} km`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function directionsHref(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=16/${lat}/${lng}`;
}
