import { describe, expect, it } from "vitest";
import { ApiError, buildQuery, errorMessage } from "@/lib/api";
import { directionsHref, km, telHref } from "@/lib/format";
import { IMPORT_ERROR_LABELS, medicineLabel } from "@/lib/labels";

describe("buildQuery", () => {
  it("drops empty values and joins arrays", () => {
    expect(buildQuery({ q: "para", page: 2, empty: "", none: undefined, status: ["IN_STOCK", "LOW_STOCK"] })).toBe(
      "?q=para&page=2&status=IN_STOCK%2CLOW_STOCK",
    );
    expect(buildQuery({})).toBe("");
  });
});

describe("errorMessage", () => {
  it("maps API error codes to Albanian messages", () => {
    expect(errorMessage(new ApiError(409, "DUPLICATE_INVENTORY", "x"))).toMatch(/ekziston tashmë/);
    expect(errorMessage(new ApiError(403, "FORBIDDEN", "x"))).toBe("Nuk keni leje për këtë veprim.");
    expect(errorMessage(new ApiError(401, "UNAUTHORIZED", "Invalid email or password"))).toMatch(/pasaktë/);
    expect(errorMessage(new Error("boom"))).toMatch(/gabim i papritur/);
  });
});

describe("format", () => {
  it("formats distances", () => {
    expect(km(0.35)).toBe("350 m");
    expect(km(null)).toBe("");
  });
  it("builds safe tel: and directions links", () => {
    expect(telHref("+383 (44) 123-456")).toBe("tel:+38344123456");
    expect(directionsHref(42.66, 21.16)).toContain("to=42.66%2C21.16");
  });
});

describe("labels", () => {
  it("labels medicines with strength and form", () => {
    expect(medicineLabel({ name: "Paracetamol", strength: "500 mg", dosageForm: "TABLET" })).toBe("Paracetamol · 500 mg · tableta");
  });
  it("explains import errors in Albanian", () => {
    expect(IMPORT_ERROR_LABELS.DUPLICATE_ROW({ firstRow: 4 })).toContain("rreshtin 4");
  });
});
