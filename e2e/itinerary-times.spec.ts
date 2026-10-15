import { expect, test, type Page } from "@playwright/test";

const tripId = process.env.E2E_TRIP_ID ?? "9fb966cd-2344-4caa-8c97-254a7635d017";

async function authenticate(page: Page) {
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // 1) Preferir sesión inyectada por Lovable.
  if (storageKey && session) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: storageKey,
      value: session,
    });
    await page.goto(`/viajes/${tripId}`, { waitUntil: "domcontentloaded" });
    return;
  }

  // 2) Fallback: iniciar sesión con email/contraseña vía formulario /auth.
  if (!email || !password) {
    throw new Error(
      "E2E requiere sesión: definí E2E_EMAIL y E2E_PASSWORD, " +
        "o inyectá LOVABLE_BROWSER_SUPABASE_STORAGE_KEY + LOVABLE_BROWSER_SUPABASE_SESSION_JSON.",
    );
  }

  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 }),
    page.getByRole("button", { name: /iniciar sesión|entrar|sign in/i }).click(),
  ]);
  await page.goto(`/viajes/${tripId}`, { waitUntil: "domcontentloaded" });
}

async function allCostGroups(page: Page) {
  const groups = page.locator('[data-testid^="cost-group-"]');
  const result: Array<{ key: string; ids: string[] }> = [];
  for (let groupIndex = 0; groupIndex < (await groups.count()); groupIndex += 1) {
    const group = groups.nth(groupIndex);
    const displays = group.locator('[data-testid^="cost-time-display-"]');
    if ((await displays.count()) === 0) continue;
    const key = (await group.getAttribute("data-cost-day")) ?? "unknown";
    const ids: string[] = [];
    for (let costIndex = 0; costIndex < (await displays.count()); costIndex += 1) {
      const testId = await displays.nth(costIndex).getAttribute("data-testid");
      if (!testId) throw new Error(`Costo sin data-testid en grupo ${key}`);
      ids.push(testId.replace("cost-time-display-", ""));
    }
    result.push({ key, ids });
  }
  return result;
}

async function setTime(
  page: Page,
  costId: string,
  start: string,
  end: string,
  method: "enter" | "check" | "outside",
) {
  await page.getByTestId(`cost-time-display-${costId}`).click();
  const startInput = page.getByTestId(`cost-time-start-${costId}`);
  const endInput = page.getByTestId(`cost-time-end-${costId}`);
  await startInput.fill(start);
  await endInput.fill(end);

  if (method === "enter") await endInput.press("Enter");
  if (method === "check") await page.getByTestId(`cost-time-save-${costId}`).click({ force: true });
  if (method === "outside")
    await page.getByRole("heading", { name: "Resumen del Viaje" }).click({ force: true });

  const display = page.getByTestId(`cost-time-display-${costId}`);
  await expect(display).toBeVisible();
  if (start) await expect(display).not.toContainText("Sin hora");
  else await expect(display).toContainText("Sin hora");
}

async function reloadTrip(page: Page) {
  const tripUrl = `/viajes/${tripId}`;
  await page.reload({ waitUntil: "domcontentloaded" });
  const heading = page.getByText("Itinerario & Costos", { exact: true });
  try {
    await expect(heading).toBeVisible({ timeout: 5_000 });
  } catch {
    // El árbol autenticado puede quedar vacío durante un hard refresh. Volver
    // a abrir la misma ruta mantiene la sesión y sigue leyendo el dato remoto.
    await page.goto(tripUrl, { waitUntil: "domcontentloaded" });
    await expect(heading).toBeVisible();
  }
}

test.describe("horarios del itinerario", () => {
  test("General y todos los días/costos persisten con Enter, ✓ y clic fuera", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    await authenticate(page);
    await expect(page.getByText("Itinerario & Costos", { exact: true })).toBeVisible();
    const groups = await allCostGroups(page);
    expect(groups.length, "Debe existir General y al menos un día con costos").toBeGreaterThan(1);
    expect(groups[0]?.key, "El primer grupo con costos debe ser General").toBe("general");

    const methods = ["enter", "check", "outside"] as const;
    let sequence = 0;
    for (const group of groups) {
      for (const id of group.ids) {
        await page.getByTestId(`cost-time-display-${id}`).click();
        const originalStart = await page.getByTestId(`cost-time-start-${id}`).inputValue();
        const originalEnd = await page.getByTestId(`cost-time-end-${id}`).inputValue();
        await page.getByTitle("Cancelar (Esc)").click();

        for (const method of methods) {
          const hour = 6 + (sequence % 10);
          const start = `${String(hour).padStart(2, "0")}:${String(10 + sequence).slice(-2)}`;
          const end = `${String(hour + 1).padStart(2, "0")}:${String(20 + sequence).slice(-2)}`;
          sequence += 1;
          await setTime(page, id, start, end, method);
          await reloadTrip(page);
          const display = page.getByTestId(`cost-time-display-${id}`);
          await expect(display).toBeVisible();
          await display.click();
          await expect(page.getByTestId(`cost-time-start-${id}`)).toHaveValue(start);
          await expect(page.getByTestId(`cost-time-end-${id}`)).toHaveValue(end);
          await page.getByTitle("Cancelar (Esc)").click();
        }

        await setTime(page, id, originalStart, originalEnd, "check");
        await reloadTrip(page);
      }
    }
  });
});
