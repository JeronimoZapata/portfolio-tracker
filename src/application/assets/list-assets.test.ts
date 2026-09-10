import { describe, expect, it, vi } from "vitest";

import type { Asset } from "../../domain/portfolio/types";
import { ListAssets } from ".";

const asset: Asset = {
  id: "00000000-0000-4000-8000-000000000001",
  symbol: "ACME",
  name: "Acme Corp",
  type: "STOCK",
  provider: "ALPACA",
  providerIdentifier: "ACME",
  currency: "USD",
  exchange: "NYSE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ListAssets", () => {
  it("delegates asset listing to its application port", async () => {
    const list = vi.fn(async () => [asset]);

    await expect(new ListAssets({ list }).execute()).resolves.toEqual([asset]);
    expect(list).toHaveBeenCalledOnce();
  });
});
