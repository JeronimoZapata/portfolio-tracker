import "./server-only";

import { CreateTransaction, ListAssets, ListTransactions } from "@/application";
import type { Asset, Transaction } from "@/domain/portfolio";

export type TransactionListItem = {
  readonly transaction: Transaction;
  readonly asset: Asset | null;
};

export type TransactionsPageData = {
  readonly assets: Asset[];
  readonly transactions: TransactionListItem[];
};

export async function getTransactionServices() {
  // Keep the database module out of the component graph. Its import creates a
  // connection pool and can fail when DATABASE_URL is not configured, which is
  // intentionally handled by the route's database-unavailable state.
  const { db } = await import("@/db");
  const { DrizzleAssetRepository, DrizzleTransactionRepository } =
    await import("@/db/repositories");
  const { DrizzleTransactionUnitOfWork } =
    await import("@/db/transaction-unit-of-work");

  const assets = new DrizzleAssetRepository(db);
  const transactions = new DrizzleTransactionRepository(db);

  return {
    listAssets: new ListAssets(assets),
    listTransactions: new ListTransactions(assets, transactions),
    createTransaction: new CreateTransaction(
      new DrizzleTransactionUnitOfWork(db),
    ),
  };
}

export async function loadTransactionsPage(): Promise<TransactionsPageData> {
  const services = await getTransactionServices();
  const [assets, transactions] = await Promise.all([
    services.listAssets.execute(),
    services.listTransactions.execute(),
  ]);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return {
    assets,
    transactions: [...transactions].reverse().map((transaction) => ({
      transaction,
      asset: assetsById.get(transaction.assetId) ?? null,
    })),
  };
}
