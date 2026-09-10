import { calculatePosition } from "../../domain/portfolio";
import type {
  PortfolioTransaction,
  Transaction,
} from "../../domain/portfolio/types";

export function toPortfolioTransaction(
  transaction: Pick<
    Transaction,
    "id" | "type" | "quantity" | "unitPrice" | "fees" | "transactionDate"
  >,
): PortfolioTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    quantity: transaction.quantity,
    unitPrice: transaction.unitPrice,
    fees: transaction.fees,
    transactionDate: transaction.transactionDate,
  };
}

export function validateLedger(
  transactions: readonly PortfolioTransaction[],
): void {
  calculatePosition(transactions);
}

export function sortTransactions(
  transactions: readonly Transaction[],
): Transaction[] {
  return [...transactions].sort(
    (left, right) =>
      Date.parse(left.transactionDate) - Date.parse(right.transactionDate) ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}
