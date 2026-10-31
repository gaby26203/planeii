import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { BRAND_OG_IMAGE, BRAND_PHOTOS, brandPhoto, isBrandPhoto } from "../src/lib/brand-photos";

const PUBLIC_DIR = join(import.meta.dir, "..", "public");

test("cada foto de marca, su miniatura y la imagen og existen en public/", () => {
  const files = [BRAND_OG_IMAGE, ...BRAND_PHOTOS.flatMap((p) => [p.src, p.thumb])];
  for (const file of files) expect(existsSync(join(PUBLIC_DIR, file))).toBe(true);
});

test("las fotos de marca se reconocen como portada y se sirven tal cual", () => {
  expect(isBrandPhoto(brandPhoto("rio-tepuyes").src)).toBe(true);
  expect(isBrandPhoto("storage:uid/trip/1.jpg")).toBe(false);
  expect(isBrandPhoto("https://ejemplo.com/foto.jpg")).toBe(false);
  expect(isBrandPhoto("/brand/fotos/../secreto.jpg")).toBe(false);
  expect(isBrandPhoto(null)).toBe(false);
});
