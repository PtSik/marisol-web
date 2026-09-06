import { expect, it } from "bun:test";
import type { Shop } from "@/lib/portalApi";
import { manageableSalons } from "@/lib/portalSalons";

it("keeps a suspended location visible after failed cleanup so its removal can be retried", () => {
  const shops = [
    { id: "primary", status: "active" },
    { id: "extra", status: "suspended" },
    { id: "old", status: "cancelled" },
  ] as Shop[];
  expect(manageableSalons(shops).map((shop) => shop.id)).toEqual(["primary", "extra"]);
});
