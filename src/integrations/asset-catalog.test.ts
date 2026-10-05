import { describe, expect, it, vi } from "vitest";

import {
  AlpacaAssetCatalog,
  CoinGeckoAssetCatalog,
  ProviderCatalogError,
} from "./asset-catalog";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("provider asset catalogs", () => {
  it("resolves an Alpaca equity and caches repeated lookups", async () => {
    const fetchImpl = vi.fn(
      async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        return response({
          id: "alpaca-id",
          symbol: "aapl",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          class: "us_equity",
        });
      },
    );
    const catalog = new AlpacaAssetCatalog("key", "secret", {
      fetchImpl,
      cacheTtlMs: 60_000,
    });

    await expect(catalog.resolve("STOCK", " aapl ")).resolves.toMatchObject({
      provider: "ALPACA",
      providerIdentifier: "AAPL",
      symbol: "AAPL",
      exchange: "NASDAQ",
    });
    await expect(catalog.resolve("ETF", "AAPL")).resolves.toMatchObject({
      providerIdentifier: "AAPL",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toContain("/v2/assets/AAPL");
  });

  it("returns no Alpaca search result for an unknown or incompatible asset", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ symbol: "BTCUSD", name: "Bitcoin", class: "crypto" }),
    );
    const catalog = new AlpacaAssetCatalog("key", "secret", { fetchImpl });

    await expect(catalog.search("STOCK", "BTCUSD")).resolves.toEqual([]);
    await expect(catalog.resolve("STOCK", "BTCUSD")).rejects.toMatchObject({
      code: "PROVIDER_NOT_FOUND",
    });
  });

  it("maps provider status failures without exposing response details", async () => {
    const fetchImpl = vi.fn(async () => response({ detail: "secret" }, 429));
    const catalog = new AlpacaAssetCatalog("key", "secret", { fetchImpl });

    await expect(catalog.resolve("STOCK", "AAPL")).rejects.toMatchObject({
      code: "PROVIDER_RATE_LIMITED",
      provider: "ALPACA",
    });
    await expect(catalog.resolve("STOCK", "AAPL")).rejects.toBeInstanceOf(
      ProviderCatalogError,
    );
  });

  it("searches multiple CoinGecko candidates and resolves the selected id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          coins: [
            {
              id: "bitcoin",
              symbol: "btc",
              name: "Bitcoin",
              market_cap_rank: 1,
            },
            {
              id: "bitcoin-cash",
              symbol: "bch",
              name: "Bitcoin Cash",
              market_cap_rank: 20,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({ id: "bitcoin-cash", symbol: "bch", name: "Bitcoin Cash" }),
      );
    const catalog = new CoinGeckoAssetCatalog("demo-key", {
      fetchImpl,
      cacheTtlMs: 60_000,
    });

    const candidates = await catalog.search("CRYPTO", "bitcoin");
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.providerIdentifier)).toEqual(
      ["bitcoin", "bitcoin-cash"],
    );
    await expect(
      catalog.resolve("CRYPTO", "BITCOIN-CASH"),
    ).resolves.toMatchObject({
      providerIdentifier: "bitcoin-cash",
      symbol: "BCH",
      exchange: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: { "x-cg-demo-api-key": "demo-key" },
    });
  });

  it("rejects malformed CoinGecko responses and missing credentials", async () => {
    const malformed = new CoinGeckoAssetCatalog("demo-key", {
      fetchImpl: vi.fn(async () => response({ nope: true })),
    });
    await expect(malformed.search("CRYPTO", "btc")).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
    });

    const missingCredentials = new CoinGeckoAssetCatalog("");
    await expect(
      missingCredentials.search("CRYPTO", "btc"),
    ).rejects.toMatchObject({
      code: "PROVIDER_CONFIG",
    });
  });
});
