import type {
  AssetProviderCatalog,
  ProviderAssetCandidate,
} from "@/application/assets";
import type { AssetProvider, AssetType } from "@/domain/portfolio";

export type ProviderCatalogErrorCode =
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_UNAUTHORIZED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE"
  | "PROVIDER_CONFIG";

export class ProviderCatalogError extends Error {
  constructor(
    readonly code: ProviderCatalogErrorCode,
    message: string,
    readonly provider: AssetProvider,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderCatalogError";
  }
}

type FetchLike = typeof fetch;

type CatalogConfig = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

type CacheEntry<T> = { expiresAt: number; value: T };

class ExpiringCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function queryText(query: string): string {
  return query.trim();
}

async function readJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  provider: AssetProvider,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new ProviderCatalogError(
      "PROVIDER_UNAVAILABLE",
      "The provider request failed.",
      provider,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderCatalogError(
      "PROVIDER_UNAUTHORIZED",
      "The provider rejected the credentials.",
      provider,
    );
  }
  if (response.status === 404) {
    throw new ProviderCatalogError(
      "PROVIDER_NOT_FOUND",
      "The provider asset was not found.",
      provider,
    );
  }
  if (response.status === 429) {
    throw new ProviderCatalogError(
      "PROVIDER_RATE_LIMITED",
      "The provider rate limit was reached.",
      provider,
    );
  }
  if (!response.ok) {
    throw new ProviderCatalogError(
      "PROVIDER_UNAVAILABLE",
      "The provider returned an error.",
      provider,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ProviderCatalogError(
      "PROVIDER_INVALID_RESPONSE",
      "The provider returned invalid JSON.",
      provider,
      { cause: error },
    );
  }
}

function alpacaCandidate(value: unknown): ProviderAssetCandidate {
  if (typeof value !== "object" || value === null) {
    throw new ProviderCatalogError(
      "PROVIDER_INVALID_RESPONSE",
      "The Alpaca asset response was malformed.",
      "ALPACA",
    );
  }
  const row = value as Record<string, unknown>;
  if (
    row.class !== "us_equity" ||
    !nonEmptyString(row.symbol) ||
    !nonEmptyString(row.name)
  ) {
    throw new ProviderCatalogError(
      "PROVIDER_NOT_FOUND",
      "The Alpaca result is not a US equity asset.",
      "ALPACA",
    );
  }
  return {
    provider: "ALPACA",
    providerIdentifier: row.symbol.trim().toUpperCase(),
    symbol: row.symbol.trim().toUpperCase(),
    name: row.name.trim(),
    exchange: nonEmptyString(row.exchange) ? row.exchange.trim() : null,
  };
}

export class AlpacaAssetCatalog implements AssetProviderCatalog {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly cache: ExpiringCache<ProviderAssetCandidate>;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    config: CatalogConfig = {},
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 5_000;
    this.cache = new ExpiringCache(config.cacheTtlMs ?? 45_000);
  }

  async search(
    type: Extract<AssetType, "STOCK" | "ETF">,
    query: string,
  ): Promise<ProviderAssetCandidate[]> {
    if (type !== "STOCK" && type !== "ETF") return [];
    const normalized = queryText(query);
    if (!normalized) return [];
    try {
      return [await this.resolve(type, normalized)];
    } catch (error) {
      if (
        error instanceof ProviderCatalogError &&
        error.code === "PROVIDER_NOT_FOUND"
      ) {
        return [];
      }
      throw error;
    }
  }

  async resolve(
    type: Extract<AssetType, "STOCK" | "ETF">,
    providerIdentifier: string,
  ): Promise<ProviderAssetCandidate> {
    if (type !== "STOCK" && type !== "ETF") {
      throw new ProviderCatalogError(
        "PROVIDER_NOT_FOUND",
        "Alpaca only resolves US equity assets.",
        "ALPACA",
      );
    }
    if (!nonEmptyString(this.apiKey) || !nonEmptyString(this.apiSecret)) {
      throw new ProviderCatalogError(
        "PROVIDER_CONFIG",
        "Alpaca credentials are not configured.",
        "ALPACA",
      );
    }
    const identifier = providerIdentifier.trim().toUpperCase();
    if (!identifier) {
      throw new ProviderCatalogError(
        "PROVIDER_NOT_FOUND",
        "The Alpaca identifier is empty.",
        "ALPACA",
      );
    }
    const cacheKey = `ALPACA:${identifier}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const encoded = encodeURIComponent(identifier);
    const value = await readJson(
      this.fetchImpl,
      `https://paper-api.alpaca.markets/v2/assets/${encoded}`,
      {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret,
        },
      },
      "ALPACA",
      this.timeoutMs,
    );
    const candidate = alpacaCandidate(value);
    this.cache.set(cacheKey, candidate);
    return candidate;
  }
}

function coinGeckoCandidate(value: unknown): ProviderAssetCandidate {
  if (typeof value !== "object" || value === null) {
    throw new ProviderCatalogError(
      "PROVIDER_INVALID_RESPONSE",
      "The CoinGecko coin response was malformed.",
      "COINGECKO",
    );
  }
  const row = value as Record<string, unknown>;
  if (!nonEmptyString(row.id) || !nonEmptyString(row.name)) {
    throw new ProviderCatalogError(
      "PROVIDER_INVALID_RESPONSE",
      "The CoinGecko coin response was incomplete.",
      "COINGECKO",
    );
  }
  return {
    provider: "COINGECKO",
    providerIdentifier: row.id.trim().toLowerCase(),
    symbol: nonEmptyString(row.symbol)
      ? row.symbol.trim().toUpperCase()
      : row.id.trim().toUpperCase(),
    name: row.name.trim(),
    exchange: null,
  };
}

export class CoinGeckoAssetCatalog implements AssetProviderCatalog {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly searchCache: ExpiringCache<ProviderAssetCandidate[]>;
  private readonly resolveCache: ExpiringCache<ProviderAssetCandidate>;

  constructor(
    private readonly apiKey: string,
    config: CatalogConfig = {},
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 5_000;
    const ttl = config.cacheTtlMs ?? 45_000;
    this.searchCache = new ExpiringCache(ttl);
    this.resolveCache = new ExpiringCache(ttl);
  }

  async search(
    type: Extract<AssetType, "CRYPTO">,
    query: string,
  ): Promise<ProviderAssetCandidate[]> {
    if (type !== "CRYPTO") return [];
    if (!nonEmptyString(this.apiKey)) {
      throw new ProviderCatalogError(
        "PROVIDER_CONFIG",
        "CoinGecko credentials are not configured.",
        "COINGECKO",
      );
    }
    const normalized = queryText(query);
    if (!normalized) return [];
    const cacheKey = `COINGECKO:search:${normalized.toLowerCase()}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;
    const value = await readJson(
      this.fetchImpl,
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(normalized)}`,
      {
        headers: { "x-cg-demo-api-key": this.apiKey },
      },
      "COINGECKO",
      this.timeoutMs,
    );
    if (typeof value !== "object" || value === null) {
      throw new ProviderCatalogError(
        "PROVIDER_INVALID_RESPONSE",
        "The CoinGecko search response was malformed.",
        "COINGECKO",
      );
    }
    const coins = (value as { coins?: unknown }).coins;
    if (!Array.isArray(coins)) {
      throw new ProviderCatalogError(
        "PROVIDER_INVALID_RESPONSE",
        "The CoinGecko search response was incomplete.",
        "COINGECKO",
      );
    }
    const candidates = coins.flatMap((coin) => {
      if (typeof coin !== "object" || coin === null) return [];
      const row = coin as Record<string, unknown>;
      if (!nonEmptyString(row.id) || !nonEmptyString(row.name)) return [];
      return [
        {
          provider: "COINGECKO" as const,
          providerIdentifier: row.id.trim().toLowerCase(),
          symbol: nonEmptyString(row.symbol)
            ? row.symbol.trim().toUpperCase()
            : row.id.trim().toUpperCase(),
          name: row.name.trim(),
          exchange: null,
          marketCapRank:
            typeof row.market_cap_rank === "number"
              ? row.market_cap_rank
              : null,
        },
      ];
    });
    this.searchCache.set(cacheKey, candidates);
    return candidates;
  }

  async resolve(
    type: Extract<AssetType, "CRYPTO">,
    providerIdentifier: string,
  ): Promise<ProviderAssetCandidate> {
    if (type !== "CRYPTO") {
      throw new ProviderCatalogError(
        "PROVIDER_NOT_FOUND",
        "CoinGecko only resolves crypto assets.",
        "COINGECKO",
      );
    }
    if (!nonEmptyString(this.apiKey)) {
      throw new ProviderCatalogError(
        "PROVIDER_CONFIG",
        "CoinGecko credentials are not configured.",
        "COINGECKO",
      );
    }
    const identifier = providerIdentifier.trim().toLowerCase();
    if (!identifier) {
      throw new ProviderCatalogError(
        "PROVIDER_NOT_FOUND",
        "The CoinGecko identifier is empty.",
        "COINGECKO",
      );
    }
    const cacheKey = `COINGECKO:${identifier}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached) return cached;
    const value = await readJson(
      this.fetchImpl,
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(identifier)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      { headers: { "x-cg-demo-api-key": this.apiKey } },
      "COINGECKO",
      this.timeoutMs,
    );
    const candidate = coinGeckoCandidate(value);
    this.resolveCache.set(cacheKey, candidate);
    return candidate;
  }
}

export class CompositeAssetCatalog implements AssetProviderCatalog {
  constructor(
    private readonly alpaca: AlpacaAssetCatalog,
    private readonly coinGecko: CoinGeckoAssetCatalog,
  ) {}

  search(type: AssetType, query: string): Promise<ProviderAssetCandidate[]> {
    return type === "CRYPTO"
      ? this.coinGecko.search(type, query)
      : this.alpaca.search(type, query);
  }

  resolve(
    type: AssetType,
    providerIdentifier: string,
  ): Promise<ProviderAssetCandidate> {
    return type === "CRYPTO"
      ? this.coinGecko.resolve(type, providerIdentifier)
      : this.alpaca.resolve(type, providerIdentifier);
  }
}
