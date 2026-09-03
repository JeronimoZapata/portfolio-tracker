export type PortfolioErrorCode =
  "INVALID_TRANSACTION" | "INVALID_MARKET_PRICE" | "OVERSELL";

export class PortfolioDomainError extends Error {
  readonly code: PortfolioErrorCode;

  constructor(code: PortfolioErrorCode, message: string) {
    super(message);
    this.name = "PortfolioDomainError";
    this.code = code;
  }
}

export class InvalidTransactionError extends PortfolioDomainError {
  constructor(message: string) {
    super("INVALID_TRANSACTION", message);
    this.name = "InvalidTransactionError";
  }
}

export class InvalidMarketPriceError extends PortfolioDomainError {
  constructor(message: string) {
    super("INVALID_MARKET_PRICE", message);
    this.name = "InvalidMarketPriceError";
  }
}

export class OversellError extends PortfolioDomainError {
  constructor(transactionId: string, requested: string, available: string) {
    super(
      "OVERSELL",
      `Transaction ${transactionId} sells ${requested}, but only ${available} is available.`,
    );
    this.name = "OversellError";
  }
}
