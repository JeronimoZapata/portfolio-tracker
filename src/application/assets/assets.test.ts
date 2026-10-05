import { describe, expect, it } from "vitest";

import type { Asset } from "../../domain/portfolio/types";
import {
  AssetDuplicateError,
  AssetInUseError,
  AssetNotFoundError,
  AssetValidationError,
  CreateAsset,
  DeleteAsset,
  UpdateAsset,
} from ".";
import type {
  AssetFields,
  AssetProviderCatalog,
  AssetRepository,
  AssetUsageReader,
} from "./ports";

const DATE = "2026-01-01T00:00:00.000Z";

function memoryRepositories(initial: Asset[] = []) {
  const assets = new Map(initial.map((asset) => [asset.id, asset]));
  const transactionAssetIds = new Set<string>();
  let sequence = 1;
  const repository: AssetRepository = {
    list: async () => [...assets.values()],
    getById: async (id) => assets.get(id) ?? null,
    findByProviderIdentifier: async (provider, providerIdentifier) =>
      [...assets.values()].find(
        (asset) =>
          asset.provider === provider &&
          asset.providerIdentifier === providerIdentifier,
      ) ?? null,
    create: async (input) => {
      const asset: Asset = {
        id: `00000000-0000-4000-8000-00000000000${sequence++}`,
        symbol: input.symbol,
        name: input.name,
        type: input.type,
        provider: input.provider,
        providerIdentifier: input.providerIdentifier,
        currency: input.currency ?? "USD",
        exchange: input.exchange ?? null,
        createdAt: DATE,
        updatedAt: DATE,
      };
      assets.set(asset.id, asset);
      return asset;
    },
    update: async (id, input) => {
      const current = assets.get(id);
      if (!current) return null;
      const updated = { ...current, ...input, updatedAt: DATE } as Asset;
      assets.set(id, updated);
      return updated;
    },
    delete: async (id) => assets.delete(id),
  };
  const usage: AssetUsageReader = {
    hasTransactions: async (assetId) => transactionAssetIds.has(assetId),
  };
  return { repository, usage, assets, transactionAssetIds };
}

const stockInput: AssetFields = {
  symbol: " aapl ",
  name: " Apple Inc. ",
  type: "STOCK",
  provider: "ALPACA",
  providerIdentifier: " aapl ",
  exchange: " NASDAQ ",
};

describe("asset application services", () => {
  it("resolves the provider identity before creating and ignores client provider data", async () => {
    const memory = memoryRepositories();
    const catalog: AssetProviderCatalog = {
      search: async () => [],
      resolve: async () => ({
        provider: "ALPACA",
        providerIdentifier: "AAPL",
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
      }),
    };

    const created = await new CreateAsset(memory.repository, catalog).execute({
      type: "STOCK",
      provider: "COINGECKO",
      providerIdentifier: "aapl",
    });

    expect(created).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      provider: "ALPACA",
      providerIdentifier: "AAPL",
      exchange: "NASDAQ",
    });
  });

  it("does not resolve the provider again for cosmetic edits", async () => {
    const memory = memoryRepositories();
    const resolve: AssetProviderCatalog["resolve"] = async () => ({
      provider: "ALPACA" as const,
      providerIdentifier: "AAPL",
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
    });
    const catalog: AssetProviderCatalog = {
      search: async () => [],
      resolve,
    };
    const created = await new CreateAsset(memory.repository, catalog).execute({
      type: "STOCK",
      providerIdentifier: "AAPL",
    });

    let calls = 0;
    const countingCatalog: AssetProviderCatalog = {
      search: async () => [],
      resolve: async (...args) => {
        calls += 1;
        return resolve(...args);
      },
    };
    const updated = await new UpdateAsset(
      memory.repository,
      countingCatalog,
    ).execute(created.id, { name: "Apple Corporation" });

    expect(updated.name).toBe("Apple Corporation");
    expect(calls).toBe(0);
  });

  it("requires a new provider selection when changing identity", async () => {
    const memory = memoryRepositories();
    const created = await new CreateAsset(memory.repository).execute(
      stockInput,
    );
    const catalog: AssetProviderCatalog = {
      search: async () => [],
      resolve: async () => {
        throw new Error("not expected");
      },
    };

    await expect(
      new UpdateAsset(memory.repository, catalog).execute(created.id, {
        type: "CRYPTO",
      }),
    ).rejects.toBeInstanceOf(AssetValidationError);
  });

  it("creates and canonicalizes an Alpaca stock", async () => {
    const memory = memoryRepositories();
    const created = await new CreateAsset(memory.repository).execute(
      stockInput,
    );

    expect(created).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "STOCK",
      provider: "ALPACA",
      providerIdentifier: "AAPL",
      currency: "USD",
      exchange: "NASDAQ",
    });
  });

  it("creates a CoinGecko crypto identifier in lowercase", async () => {
    const memory = memoryRepositories();
    const created = await new CreateAsset(memory.repository).execute({
      symbol: " btc ",
      name: "Bitcoin",
      type: "CRYPTO",
      provider: "COINGECKO",
      providerIdentifier: " Bitcoin ",
      exchange: "   ",
    });

    expect(created).toMatchObject({
      symbol: "BTC",
      provider: "COINGECKO",
      providerIdentifier: "bitcoin",
      exchange: null,
    });
  });

  it("rejects invalid required fields, provider combinations, and exchange", async () => {
    const memory = memoryRepositories();
    const create = new CreateAsset(memory.repository);

    await expect(
      create.execute({ ...stockInput, name: "   " }),
    ).rejects.toMatchObject({ code: "ASSET_VALIDATION", field: "name" });
    await expect(
      create.execute({ ...stockInput, provider: "COINGECKO" }),
    ).rejects.toMatchObject({ code: "ASSET_VALIDATION", field: "provider" });
    await expect(
      create.execute({ ...stockInput, exchange: "" }),
    ).rejects.toMatchObject({ code: "ASSET_VALIDATION", field: "exchange" });
  });

  it("rejects duplicate identifiers after canonicalization", async () => {
    const memory = memoryRepositories();
    const create = new CreateAsset(memory.repository);
    await create.execute(stockInput);

    await expect(
      create.execute({ ...stockInput, symbol: "AAPL2" }),
    ).rejects.toBeInstanceOf(AssetDuplicateError);
  });

  it("updates fields and reassigns provider when the type changes", async () => {
    const memory = memoryRepositories();
    const created = await new CreateAsset(memory.repository).execute(
      stockInput,
    );
    const updated = await new UpdateAsset(memory.repository).execute(
      created.id,
      {
        symbol: "eth",
        name: " Ethereum ",
        type: "CRYPTO",
        provider: "COINGECKO",
        providerIdentifier: " Ethereum ",
        exchange: null,
      },
    );

    expect(updated).toMatchObject({
      symbol: "ETH",
      name: "Ethereum",
      type: "CRYPTO",
      provider: "COINGECKO",
      providerIdentifier: "ethereum",
      exchange: null,
    });
    await expect(
      new UpdateAsset(memory.repository).execute(created.id, {
        providerIdentifier: "ETHEREUM",
        provider: "COINGECKO",
      }),
    ).resolves.toMatchObject({ providerIdentifier: "ethereum" });
    const reassigned = await new UpdateAsset(memory.repository).execute(
      created.id,
      {
        type: "STOCK",
        providerIdentifier: "msft",
        symbol: "msft",
        name: "Microsoft",
        exchange: "NASDAQ",
      },
    );
    expect(reassigned).toMatchObject({
      type: "STOCK",
      provider: "ALPACA",
      providerIdentifier: "MSFT",
    });
  });

  it("excludes the current asset from duplicate checks and rejects another asset", async () => {
    const memory = memoryRepositories();
    const first = await new CreateAsset(memory.repository).execute(stockInput);
    await expect(
      new UpdateAsset(memory.repository).execute(first.id, {
        providerIdentifier: "aapl",
        provider: "ALPACA",
      }),
    ).resolves.toMatchObject({ id: first.id });

    const second = await new CreateAsset(memory.repository).execute({
      ...stockInput,
      symbol: "MSFT",
      providerIdentifier: "MSFT",
    });
    await expect(
      new UpdateAsset(memory.repository).execute(second.id, {
        providerIdentifier: "AAPL",
        provider: "ALPACA",
      }),
    ).rejects.toBeInstanceOf(AssetDuplicateError);
  });

  it("deletes unused assets and rejects missing or referenced assets", async () => {
    const memory = memoryRepositories();
    const create = new CreateAsset(memory.repository);
    const unused = await create.execute(stockInput);
    await expect(
      new DeleteAsset(memory.repository, memory.usage).execute(unused.id),
    ).resolves.toMatchObject({ id: unused.id });
    await expect(
      new DeleteAsset(memory.repository, memory.usage).execute(unused.id),
    ).rejects.toBeInstanceOf(AssetNotFoundError);

    const referenced = await create.execute({
      ...stockInput,
      providerIdentifier: "MSFT",
      symbol: "MSFT",
    });
    memory.transactionAssetIds.add(referenced.id);
    await expect(
      new DeleteAsset(memory.repository, memory.usage).execute(referenced.id),
    ).rejects.toBeInstanceOf(AssetInUseError);
  });
});
