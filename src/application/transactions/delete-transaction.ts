import type { Transaction } from "../../domain/portfolio/types";
import { TransactionNotFoundError } from "./errors";
import { toPortfolioTransaction, validateLedger } from "./ledger";
import type { TransactionUnitOfWork } from "./ports";
import { normalizeTransactionId } from "./validation";

export class DeleteTransaction {
  constructor(private readonly unitOfWork: TransactionUnitOfWork) {}

  async execute(id: string): Promise<Transaction> {
    const transactionId = normalizeTransactionId(id);
    return this.unitOfWork.execute(async (context) => {
      const current = await context.lockTransaction(transactionId);
      if (!current) throw new TransactionNotFoundError(transactionId);

      await context.lockAssets([current.assetId]);
      const ledger = await context.transactions.list({
        assetId: current.assetId,
      });
      validateLedger(
        ledger
          .filter((transaction) => transaction.id !== transactionId)
          .map(toPortfolioTransaction),
      );

      const deleted = await context.transactions.delete(transactionId);
      if (!deleted) throw new TransactionNotFoundError(transactionId);
      return current;
    });
  }
}
