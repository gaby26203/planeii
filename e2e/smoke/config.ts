// Configuración y utilidades compartidas de la lista de comprobación (`bun run smoke`).
// Todo se define por variables de entorno para poder correrla contra cualquier despliegue.

import { expect, type Page } from "@playwright/test";

export const SMOKE = {
  baseURL: process.env.SMOKE_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
  /** Cuenta de prueba. Para las pruebas de escritura tiene que poder crear viajes (owner). */
  email: process.env.SMOKE_EMAIL ?? "",
  password: process.env.SMOKE_PASSWORD ?? "",
  /** Slug de una landing publicada de prueba, con formulario interno y sin preguntas obligatorias propias. */
  slug: process.env.SMOKE_SLUG ?? "",
  /** Con `SMOKE_WRITE=1` se crean y borran datos: un viaje de prueba y una solicitud. */
  write: process.env.SMOKE_WRITE === "1",
};

export const hasAccount = Boolean(SMOKE.email && SMOKE.password);

/** Algunas comprobaciones solo tienen sentido en un despliegue real, no en `vite dev`. */
export const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(SMOKE.baseURL);

/** Evita que cada corrida sume visitas falsas a las métricas de la landing. */
export async function blockAnalytics(page: Page) {
  await page.route("**/api/public/track", (route) => route.abort());
}

export async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(SMOKE.email);
  await page.getByLabel("Contraseña").fill(SMOKE.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mis viajes" })).toBeVisible({ timeout: 20_000 });
}

/** Recorre la página hasta el final para que carguen las imágenes diferidas. */
export async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(100);
  }
  await page.waitForLoadState("networkidle");
}

/** Imágenes que terminaron de cargar sin contenido: rutas rotas o archivos que no existen. */
export async function brokenImages(page: Page) {
  return page.$$eval("img", (imgs) =>
    imgs
      .filter((img) => img.getAttribute("src") && img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute("src")),
  );
}
