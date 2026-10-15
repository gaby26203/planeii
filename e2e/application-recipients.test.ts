import { expect, test } from "bun:test";
import { organizerRecipientIds } from "../src/lib/application-recipients";

test("aviso llega a la dueña y organizadoras, sin tour leaders ni duplicados", () => {
  const ids = organizerRecipientIds("owner", [
    { user_id: "org2", role: "organizadora" },
    { user_id: "leader", role: "tour_leader" },
    { user_id: "owner", role: "organizadora" },
  ]);
  expect(ids).toEqual(["owner", "org2"]);
});
