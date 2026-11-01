// Comprobaciones que escriben datos (solo con SMOKE_WRITE=1): crea un viaje de prueba con
// portada, sube un archivo al storage, lo borra todo y envía una solicitud a la landing de prueba.
// Si una prueba falla a la mitad, el viaje "[prueba] …" queda en el panel y hay que borrarlo a mano.

import path from "node:path";
import { expect, test } from "@playwright/test";
import { BRAND_PHOTOS } from "../../src/lib/brand-photos";
import { blockAnalytics, hasAccount, login, SMOKE } from "./config";

const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
const tripName = `[prueba] ${stamp}`;
const galleryPhoto = BRAND_PHOTOS[0];
const uploadFile = path.join(import.meta.dirname, "../../public/brand/fotos/vicunas-thumb.jpg");

test.describe.serial("con escritura", () => {
  test.skip(!SMOKE.write || !hasAccount, "define SMOKE_WRITE=1, SMOKE_EMAIL y SMOKE_PASSWORD");

  let tripPath = "";

  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("crea un viaje con portada de la galería y persiste", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Nuevo viaje" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre del viaje *").fill(tripName);
    await dialog.getByLabel("Destino *").fill("Prueba automática");
    await dialog.getByRole("tab", { name: "Galería" }).click();
    await dialog.getByRole("button", { name: galleryPhoto.alt }).click();
    await dialog.getByRole("button", { name: "Crear viaje" }).click();
    await dialog.getByRole("button", { name: "Saltar" }).click();

    await expect(page).toHaveURL(/\/viajes\/[^/]+$/);
    tripPath = new URL(page.url()).pathname;
    await page.reload();
    await expect(page.getByText(tripName).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`img[src*="${galleryPhoto.src}"]`).first()).toBeVisible();
  });

  test("sube una portada al storage y la quita", async ({ page }) => {
    test.skip(!tripPath, "no se creó el viaje");
    await login(page);
    await page.goto(tripPath);
    await page.getByRole("button", { name: "Cambiar foto" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(uploadFile);
    await expect(page.getByText("Foto de portada actualizada")).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole("button", { name: "Listo" }).click();

    // La portada subida se sirve con una URL firmada del bucket privado.
    const cover = page.locator('img[src*="trip-covers"]').first();
    await expect(cover).toBeVisible({ timeout: 20_000 });
    expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Quitarla desde la cabecera borra también el archivo, así la prueba no deja huérfanos.
    await page.getByRole("button", { name: "Eliminar foto" }).click();
    await expect(page.getByRole("button", { name: "Añadir foto" })).toBeVisible();
  });

  test("manda el viaje a la papelera y lo elimina", async ({ page }) => {
    test.skip(!tripPath, "no se creó el viaje");
    await login(page);
    await page.goto(tripPath);
    await page.getByRole("button", { name: "Acciones del viaje" }).click();
    await page.getByRole("menuitem", { name: "Eliminar viaje" }).click();
    await page.getByLabel("Nombre del viaje").fill(tripName);
    await page.getByRole("button", { name: "Mover a la papelera" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/papelera");
    const row = page
      .locator("div")
      .filter({ has: page.getByText(tripName, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Eliminar ya" }) })
      .last();
    await row.getByRole("button", { name: "Eliminar ya" }).click();
    await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page.getByText(tripName, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  });

  test("envía una solicitud por el formulario público", async ({ page }) => {
    test.skip(!SMOKE.slug, "define SMOKE_SLUG");
    await page.goto(`/v/${SMOKE.slug}/reservar`);
    await page.locator('input[autocomplete="name"]').fill("Prueba Automática");
    await page.getByLabel("Código de país").selectOption("+58");
    await page.getByLabel("Número de WhatsApp").fill("4120000000");
    await page.locator('input[type="email"]').fill(SMOKE.email);
    const consent = page.locator('form input[type="checkbox"]');
    if (await consent.count()) await consent.first().check();
    await page.locator("form button[type=submit]").click();

    const sent = page.locator("form");
    await expect(sent, "el formulario no se envió")
      .toHaveCount(0, { timeout: 20_000 })
      .catch(async (e) => {
        const alert = await page
          .getByRole("alert")
          .textContent()
          .catch(() => null);
        throw alert ? new Error(`El formulario respondió: ${alert}`) : e;
      });
  });
});
