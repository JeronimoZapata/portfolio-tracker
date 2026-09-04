import type { AssetRow, TransactionRow } from "./schema";
import type { Asset, Transaction } from "../domain/portfolio/types";

export function toDomainAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    type: row.type,
    provider: row.provider,
    providerIdentifier: row.providerIdentifier,
    currency: row.currency,
    exchange: row.exchange,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDomainTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    assetId: row.assetId,
    type: row.type,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    currency: row.currency,
    fees: row.fees,
    transactionDate: row.transactionDate.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
