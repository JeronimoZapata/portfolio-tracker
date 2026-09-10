import type {
  Asset,
  AssetProvider,
  AssetType,
  Transaction,
  TransactionType,
} from "../../domain/portfolio/types";

export type CreateAssetInput = {
  symbol: string;
  name: string;
  type: AssetType;
  provider: AssetProvider;
  providerIdentifier: string;
  currency?: string;
  exchange?: string | null;
};

export type UpdateAssetInput = Partial<CreateAssetInput>;

export interface AssetRepository {
  create(input: CreateAssetInput): Promise<Asset>;
  getById(id: string): Promise<Asset | null>;
  list(): Promise<Asset[]>;
  update(id: string, input: UpdateAssetInput): Promise<Asset | null>;
  delete(id: string): Promise<boolean>;
}

export type CreateTransactionInput = {
  assetId: string;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  transactionDate: string;
  currency?: string;
  fees?: string;
  notes?: string | null;
};

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export type TransactionListOptions = {
  assetId?: string;
};

export interface TransactionRepository {
  create(input: CreateTransactionInput): Promise<Transaction>;
  getById(id: string): Promise<Transaction | null>;
  list(options?: TransactionListOptions): Promise<Transaction[]>;
  update(
    id: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction | null>;
  delete(id: string): Promise<boolean>;
}
