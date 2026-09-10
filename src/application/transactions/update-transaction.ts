import type { Transaction } from "../../domain/portfolio/types";
import { AssetNotFoundError, TransactionNotFoundError } from "./errors";
import { toPortfolioTransaction, validateLedger } from "./ledger";
import type { TransactionUnitOfWork, UpdateTransactionCommand } from "./ports";
import {
  normalizeTransactionRecord,
  normalizeTransactionId,
  normalizeUpdateTransaction,
} from "./validation";

export class UpdateTransaction {
  constructor(private readonly unitOfWork: TransactionUnitOfWork) {}

  async execute(
    id: string,
    input: UpdateTransactionCommand,
  ): Promise<Transaction> {
    const transactionId = normalizeTransactionId(id);
    const changes = normalizeUpdateTransaction(input);

    return this.unitOfWork.execute(async (context) => {
      const current = await context.lockTransaction(transactionId);
      if (!current) throw new TransactionNotFoundError(transactionId);

      const merged = normalizeTransactionRecord({
        ...current,
        ...changes,
      });
      const assetIds = [current.assetId, merged.assetId].sort();
      const assets = await context.lockAssets([...new Set(assetIds)]);
      if (!assets.some((asset) => asset.id === merged.assetId)) {
        throw new AssetNotFoundError(merged.assetId);
      }

      const oldLedger = await context.transactions.list({
        assetId: current.assetId,
      });
      const candidate = toPortfolioTransaction(merged);

      if (current.assetId === merged.assetId) {
        validateLedger(
          oldLedger.map((transaction) =>
            transaction.id === transactionId
              ? candidate
              : toPortfolioTransaction(transaction),
          ),
        );
      } else {
        validateLedger(
          oldLedger
            .filter((transaction) => transaction.id !== transactionId)
            .map(toPortfolioTransaction),
        );
        const newLedger = await context.transactions.list({
          assetId: merged.assetId,
        });
        validateLedger([...newLedger.map(toPortfolioTransaction), candidate]);
      }

      const updated = await context.transactions.update(transactionId, changes);
      if (!updated) throw new TransactionNotFoundError(transactionId);
      return updated;
    });
  }
}
