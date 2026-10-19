import { expect, test } from "@playwright/test";

test("public user searches a medicine and sees reported availability", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gjeni barin");
  await page.getByRole("combobox").fill("paracetamol 500");
  await page.getByRole("button", { name: "Kërko", exact: true }).click();

  const results = page.locator("#rezultatet");
  await expect(results.getByRole("heading", { name: /Rezultatet për/ })).toBeVisible();
  await results.getByRole("link", { name: /Paracetamol/ }).first().click();

  await expect(page).toHaveURL(/\/medicines\//);
  await expect(page.getByRole("heading", { name: "Disponueshmëria e raportuar" })).toBeVisible();
  await expect(page.getByText("Disponueshmëria e raportuar — kontakto farmacinë për konfirmim.").first()).toBeVisible();
  await expect(page.getByText(/Përditësuar/).first()).toBeVisible();
});

test("search works without location access and handles no results", async ({ page }) => {
  await page.goto("/?q=zzzz-nuk-ekziston");
  await expect(page.getByText("Nuk u gjet asnjë bar")).toBeVisible();
});

test("protected pages redirect to login and bad credentials are rejected", async ({ page }) => {
  await page.goto("/dashboard/inventory");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Finventory/);
  await page.getByLabel("Email").fill("nobody@medifind.test");
  await page.getByLabel("Fjalëkalimi").fill("wrong-password-1");
  await page.getByRole("button", { name: "Kyçu" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "pasaktë" })).toBeVisible();
});

test("pharmacies page lists verified pharmacies with a map", async ({ page }) => {
  await page.goto("/pharmacies");
  await expect(page.getByRole("heading", { name: "Farmacitë", level: 1 })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("link", { name: /Farmacia/ }).first()).toBeVisible();
});
