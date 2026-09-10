import type { TransactionUnitOfWork } from "../application/transactions";
import type { TransactionMutationContext } from "../application/transactions";
import type { Database } from "./index";
import { DrizzleAssetRepository } from "./repositories/asset-repository";
import { DrizzleTransactionRepository } from "./repositories/transaction-repository";
import type { Clock } from "./repositories/asset-repository";

/**
 * Runs transaction-ledger validation and the corresponding write in one
 * PostgreSQL transaction. Asset and transaction row locks are exposed through
 * the mutation context so every application mutation follows the same order.
 */
export class DrizzleTransactionUnitOfWork implements TransactionUnitOfWork {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async execute<T>(
    work: (context: TransactionMutationContext) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) => {
      // Drizzle's transaction executor has the same query-builder surface as
      // Database, but a narrower nominal type. The repositories only use that
      // shared surface, so this cast keeps the adapter boundary explicit.
      const executor = transaction as unknown as Database;
      const assets = new DrizzleAssetRepository(executor, this.clock);
      const transactions = new DrizzleTransactionRepository(
        executor,
        this.clock,
      );

      return work({
        assets,
        transactions,
        lockAssets: (ids) => assets.lockMany(ids),
        lockTransaction: (id) => transactions.lockById(id),
      });
    });
  }
}
