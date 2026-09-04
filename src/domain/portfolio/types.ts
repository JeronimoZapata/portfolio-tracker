export type DecimalInput = string;

export type TransactionType = "BUY" | "SELL";
export type AssetType = "STOCK" | "ETF" | "CRYPTO";
export type AssetProvider = "ALPACA" | "COINGECKO";

export interface Asset {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly type: AssetType;
  readonly provider: AssetProvider;
  readonly providerIdentifier: string;
  readonly currency: string;
  readonly exchange: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PortfolioTransaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly quantity: DecimalInput;
  readonly unitPrice: DecimalInput;
  readonly fees: DecimalInput;
  readonly transactionDate: string;
}

export interface Transaction extends PortfolioTransaction {
  readonly assetId: string;
  readonly currency: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
