export type DecimalInput = string;

export type TransactionType = "BUY" | "SELL";

export interface PortfolioTransaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly quantity: DecimalInput;
  readonly unitPrice: DecimalInput;
  readonly fees: DecimalInput;
  readonly transactionDate: string;
}

export interface PositionResult {
  readonly quantity: string;
  readonly averageCost: string;
  readonly remainingCostBasis: string;
  readonly realizedProfitLoss: string;
}

export interface ValuedPositionResult extends PositionResult {
  readonly marketPrice: string;
  readonly marketValue: string;
  readonly unrealizedProfitLoss: string;
  readonly unrealizedReturnPercentage: string | null;
  readonly totalProfitLoss: string;
}
