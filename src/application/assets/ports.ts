import type { Asset } from "../../domain/portfolio/types";
import type { AssetProvider, AssetType } from "../../domain/portfolio/types";

export interface AssetCatalog {
  list(): Promise<Asset[]>;
}

/**
 * Server-side boundary for resolving an asset against its market-data
 * provider. The browser may submit a selected identifier, but the
 * application must resolve it again before persisting a new identity.
 */
export type ProviderAssetCandidate = {
  provider: AssetProvider;
  providerIdentifier: string;
  symbol: string;
  name: string;
  exchange: string | null;
  marketCapRank?: number | null;
};

export interface AssetProviderCatalog {
  search(type: AssetType, query: string): Promise<ProviderAssetCandidate[]>;
  resolve(
    type: AssetType,
    providerIdentifier: string,
  ): Promise<ProviderAssetCandidate>;
}

export type AssetFields = {
  symbol: string;
  name: string;
  type: AssetType;
  provider: AssetProvider;
  providerIdentifier: string;
  currency?: string;
  exchange?: string | null;
};

export type CreateAssetCommand = Omit<
  AssetFields,
  "provider" | "symbol" | "name"
> & {
  /** Canonical provider reference returned by the provider search. */
  providerIdentifier: string;
  /** Optional for provider-backed commands; filled from the catalog. */
  symbol?: string;
  /** Ignored by the application when present; derived from type. */
  provider?: AssetProvider;
  /** Name is still editable after a provider result is selected. */
  name?: string;
};
export type UpdateAssetCommand = Partial<AssetFields>;

export interface AssetRepository extends AssetCatalog {
  getById(id: string): Promise<Asset | null>;
  findByProviderIdentifier(
    provider: AssetProvider,
    providerIdentifier: string,
  ): Promise<Asset | null>;
  create(input: AssetFields): Promise<Asset>;
  update(id: string, input: Partial<AssetFields>): Promise<Asset | null>;
  delete(id: string): Promise<boolean>;
}

export interface AssetUsageReader {
  hasTransactions(assetId: string): Promise<boolean>;
}
