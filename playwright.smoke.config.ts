// Lista de comprobación de un despliegue: `bun run smoke`. Ver docs/migracion.md, sección 8.
import { defineConfig, devices } from "@playwright/test";
import { SMOKE } from "./e2e/smoke/config";

export default defineConfig({
  testDir: "./e2e/smoke",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/smoke" }]],
  use: {
    baseURL: SMOKE.baseURL,
    viewport: { width: 1280, height: 900 },
    locale: "es-VE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "Chrome", use: { ...devices["Desktop Chrome"] } }],
});
