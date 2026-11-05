// Comprobaciones con la cuenta de prueba, solo de lectura: ingreso, panel, un viaje, el editor
// de la página de venta, las métricas y el modo presentación.

import { expect, test } from "@playwright/test";
import { blockAnalytics, hasAccount, login } from "./config";

test.describe("con sesión", () => {
  test.skip(!hasAccount, "define SMOKE_EMAIL y SMOKE_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await login(page);
  });

  test("el panel carga los viajes", async ({ page }) => {
    await expect(page.getByText(/^\d+ viajes? activos?$/)).toBeVisible();
  });

  test("abre un viaje, su página de venta y sus métricas", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const card = page.locator('a[href^="/viajes/"]').first();
    test.skip((await card.count()) === 0, "la cuenta de prueba no tiene viajes");

    await card.click();
    await expect(page).toHaveURL(/\/viajes\/[^/]+$/);
    const tripPath = new URL(page.url()).pathname;
    await expect(page.getByRole("link", { name: "Mis viajes" })).toBeVisible();

    await page.getByRole("link", { name: "Página de venta" }).click();
    await expect(page).toHaveURL(new RegExp(`${tripPath}/pagina$`));
    await expect(page.getByRole("button", { name: "Vista móvil" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("iframe").first()).toBeVisible();

    await page.goto(`${tripPath}/metricas`);
    await expect(page.getByRole("heading", { name: "Métricas de la landing" })).toBeVisible();
  });

  test("el modo presentación solo muestra viajes vitrina", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("planeii-presentation-mode", "1"));
    await page.reload();
    await expect(page.getByText("Modo presentación.")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Cada tarjeta es un enlace a /viajes/<id>; en el modo todas tienen que llevar la marca.
    const cards = await page.$$eval('a[href^="/viajes/"]', (links) =>
      links
        .filter((a) => /^\/viajes\/[^/]+$/.test(a.getAttribute("href") ?? ""))
        .map((a) => a.textContent ?? ""),
    );
    if (cards.length === 0) await expect(page.getByText("No hay viajes vitrina")).toBeVisible();
    else expect(cards.filter((text) => !text.includes("Vitrina"))).toEqual([]);

    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(page.getByText("Modo presentación.")).toHaveCount(0);
  });
});
