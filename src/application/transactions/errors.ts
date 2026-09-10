export type ApplicationTransactionErrorCode =
  "ASSET_NOT_FOUND" | "TRANSACTION_NOT_FOUND" | "TRANSACTION_VALIDATION";

export class TransactionApplicationError extends Error {
  readonly code: ApplicationTransactionErrorCode;

  constructor(code: ApplicationTransactionErrorCode, message: string) {
    super(message);
    this.name = "TransactionApplicationError";
    this.code = code;
  }
}

export class AssetNotFoundError extends TransactionApplicationError {
  readonly assetId: string;

  constructor(assetId: string) {
    super("ASSET_NOT_FOUND", `Asset ${assetId} was not found.`);
    this.name = "AssetNotFoundError";
    this.assetId = assetId;
  }
}

export class TransactionNotFoundError extends TransactionApplicationError {
  readonly transactionId: string;

  constructor(transactionId: string) {
    super(
      "TRANSACTION_NOT_FOUND",
      `Transaction ${transactionId} was not found.`,
    );
    this.name = "TransactionNotFoundError";
    this.transactionId = transactionId;
  }
}

export class TransactionValidationError extends TransactionApplicationError {
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super("TRANSACTION_VALIDATION", message);
    this.name = "TransactionValidationError";
    this.field = field;
  }
}
