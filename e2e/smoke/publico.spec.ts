// Comprobaciones sin cuenta: lo que ve una visitante y lo que responde la API pública.
// No escriben nada en la base.

import { expect, test } from "@playwright/test";
import { blockAnalytics, brokenImages, isLocal, scrollThrough, SMOKE } from "./config";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test("el ingreso muestra el formulario", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
  expect(await brokenImages(page)).toEqual([]);
});

test("las páginas internas piden sesión", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);
});

test("las fotos de marca se sirven", async ({ request }) => {
  for (const path of ["/brand/fotos/og.jpg", "/brand/fotos/rio-tepuyes.jpg"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toContain("image/jpeg");
  }
});

test("la API de solicitudes rechaza datos inválidos", async ({ request }) => {
  const res = await request.post("/api/public/apply", { data: {} });
  expect(res.status()).toBe(400);
});

test("la API de solicitudes llega a la base", async ({ request }) => {
  // Un slug que no existe obliga al servidor a consultar la base con la service role y
  // responder 404, sin escribir nada. Un 500 indica credenciales o red mal configuradas.
  const res = await request.post("/api/public/apply", {
    data: {
      slug: `no-existe-${Date.now()}`,
      fullName: "Prueba Automática",
      whatsapp: "+584120000000",
      email: "prueba@example.com",
    },
  });
  expect(res.status()).toBe(404);
});

test("la API de métricas rechaza datos inválidos", async ({ request }) => {
  const res = await request.post("/api/public/track", { data: {} });
  expect(res.status()).toBe(400);
});

test("una landing inexistente se muestra como no encontrada", async ({ page }) => {
  await page.goto(`/v/no-existe-${Date.now()}`);
  // "No se pudo cargar la página" en lugar de esto indica que el servidor no llega a la base.
  await expect(
    page.getByRole("heading", { name: "Esta página no existe o fue retirada." }),
  ).toBeVisible();
});

test.describe("solo en el despliegue", () => {
  test.skip(isLocal, "no aplica en localhost");

  test("la vista previa de correos no está expuesta", async ({ request }) => {
    const res = await request.get("/api/dev/email-preview");
    expect(res.status()).toBe(404);
  });

  test("la imagen para compartir usa la URL pública", async ({ page, request }) => {
    await page.goto("/auth");
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(og, "falta VITE_PUBLIC_SITE_URL al compilar").toMatch(/^https:\/\//);
    expect((await request.get(og!)).status()).toBe(200);
  });
});

test.describe("landing publicada", () => {
  test.skip(!SMOKE.slug, "define SMOKE_SLUG");

  test("carga con sus fotos", async ({ page }) => {
    const res = await page.goto(`/v/${SMOKE.slug}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/ · /);
    await scrollThrough(page);
    expect(await brokenImages(page)).toEqual([]);
  });

  test("tiene imagen para compartir", async ({ page, request }) => {
    test.skip(isLocal, "no aplica en localhost");
    await page.goto(`/v/${SMOKE.slug}`);
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(og).toMatch(/^https:\/\//);
    expect((await request.get(og!)).status()).toBe(200);
  });

  test("la página de reserva carga", async ({ page }) => {
    const res = await page.goto(`/v/${SMOKE.slug}/reservar`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("form button[type=submit]")).toBeVisible();
  });
});
