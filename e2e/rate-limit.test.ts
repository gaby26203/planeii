import { describe, expect, test } from "bun:test";
import { clientIp, createRateLimiter } from "../src/lib/rate-limit";

describe("createRateLimiter", () => {
  test("deja pasar hasta el límite y frena el resto de la ventana", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([1, 2, 3, 4].map(() => rl.hit("a", 0))).toEqual([true, true, true, false]);
    expect(rl.hit("a", 999)).toBe(false);
  });

  test("cada clave cuenta aparte", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("b", 0)).toBe(true);
    expect(rl.hit("a", 1)).toBe(false);
  });

  test("al vencer la ventana vuelve a contar desde cero", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 500)).toBe(false);
    expect(rl.hit("a", 1000)).toBe(true);
  });

  test("no guarda más claves que el tope", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) rl.hit(`ip-${i}`, i);
    expect(rl.size()).toBeLessThanOrEqual(100);
    // La más reciente sigue contada.
    expect(rl.hit("ip-999", 1000)).toBe(false);
  });
});

describe("clientIp", () => {
  test("prefiere la IP de Cloudflare", () => {
    const h = new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" });
    expect(clientIp(h)).toBe("1.1.1.1");
  });

  test("usa la primera de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
  });

  test("sin encabezados no inventa una IP", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});
