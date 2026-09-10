import type {
  Asset,
  PortfolioTransaction,
  Transaction,
  TransactionType,
} from "../../domain/portfolio/types";

/** The normalized record written by the application layer. */
export type CreateTransactionRecord = PortfolioTransaction & {
  readonly assetId: string;
  readonly currency: string;
  readonly notes: string | null;
};

export type UpdateTransactionRecord = Partial<
  Omit<CreateTransactionRecord, "id">
>;

export type TransactionListOptions = {
  readonly assetId?: string;
};

export interface AssetReader {
  getById(id: string): Promise<Asset | null>;
}

/** Alias used by callers that model the asset lookup as a repository port. */
export type AssetRepository = AssetReader;

export interface TransactionRepository {
  create(input: CreateTransactionRecord): Promise<Transaction>;
  getById(id: string): Promise<Transaction | null>;
  list(options?: TransactionListOptions): Promise<Transaction[]>;
  update(
    id: string,
    input: UpdateTransactionRecord,
  ): Promise<Transaction | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Repository view used inside a mutation. Implementations acquire database
 * locks before returning from lock* methods; the in-memory implementation is
 * deliberately serialized instead.
 */
export interface TransactionMutationContext {
  readonly assets: AssetReader;
  readonly transactions: TransactionRepository;
  lockAssets(ids: readonly string[]): Promise<Asset[]>;
  lockTransaction(id: string): Promise<Transaction | null>;
}

export interface TransactionUnitOfWork {
  execute<T>(
    work: (context: TransactionMutationContext) => Promise<T>,
  ): Promise<T>;
}

export type CreateTransactionCommand = {
  assetId: string;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  transactionDate: string;
  currency?: string;
  fees?: string;
  notes?: string | null;
};

export type UpdateTransactionCommand = Partial<CreateTransactionCommand>;

export type CreateTransactionInput = CreateTransactionCommand;
export type UpdateTransactionInput = UpdateTransactionCommand;

export type ListTransactionsQuery = TransactionListOptions;

export type IdGenerator = () => string;
