import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("@/components/auth-provider", () => ({ useAuth: vi.fn(), homeFor: vi.fn() }));

describe("safeNext (post-login redirect)", () => {
  it("only allows same-site relative paths", async () => {
    const { safeNext } = await import("@/components/auth/auth-forms");
    expect(safeNext("/dashboard/inventory")).toBe("/dashboard/inventory");
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
