import type { Transaction } from "../../domain/portfolio/types";
import { AssetNotFoundError } from "./errors";
import { sortTransactions } from "./ledger";
import type {
  AssetRepository,
  ListTransactionsQuery,
  TransactionRepository,
} from "./ports";
import { normalizeAssetId } from "./validation";

export class ListTransactions {
  constructor(
    private readonly assets: AssetRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(query: ListTransactionsQuery = {}): Promise<Transaction[]> {
    let normalizedQuery = query;
    if (query.assetId !== undefined) {
      const assetId = normalizeAssetId(query.assetId);
      const asset = await this.assets.getById(assetId);
      if (!asset) throw new AssetNotFoundError(assetId);
      normalizedQuery = { assetId };
    }

    return sortTransactions(await this.transactions.list(normalizedQuery));
  }
}
