import { Decimal } from "decimal.js";

import type {
  AssetProvider,
  AssetType,
  TransactionType,
} from "../../domain/portfolio/types";
import type {
  CreateAssetInput,
  CreateTransactionInput,
  UpdateAssetInput,
  UpdateTransactionInput,
} from "./types";

export class PersistenceValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "PersistenceValidationError";
    this.field = field;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoWithTimezonePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/;
const decimalPattern = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/;

function requiredText(field: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PersistenceValidationError(field, "must be a non-empty string");
  }
  return value.trim();
}

function optionalText(
  field: string,
  value: unknown,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  return requiredText(field, value);
}

function uuid(field: string, value: unknown): string {
  const text = requiredText(field, value);
  if (!uuidPattern.test(text)) {
    throw new PersistenceValidationError(field, "must be a valid UUID");
  }
  return text;
}

function oneOf<T extends string>(
  field: string,
  value: unknown,
  values: readonly T[],
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new PersistenceValidationError(
      field,
      `must be one of ${values.join(", ")}`,
    );
  }
  return value as T;
}

function currency(value: unknown): string {
  const result = requiredText("currency", value);
  if (result !== "USD") {
    throw new PersistenceValidationError("currency", "must be USD");
  }
  return result;
}

function providerMatchesType(type: AssetType, provider: AssetProvider): void {
  const valid =
    (type === "CRYPTO" && provider === "COINGECKO") ||
    ((type === "STOCK" || type === "ETF") && provider === "ALPACA");
  if (!valid) {
    throw new PersistenceValidationError(
      "provider",
      "does not match the selected asset type",
    );
  }
}

function decimal(
  field: string,
  value: unknown,
  precision: number,
  scale: number,
  positive: boolean,
): string {
  const text = requiredText(field, value);
  if (!decimalPattern.test(text)) {
    throw new PersistenceValidationError(field, "must be a decimal string");
  }

  const unsigned = text.startsWith("+") ? text.slice(1) : text;
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const significantIntegerDigits = integerPart.replace(/^0+/, "").length;
  const maxIntegerDigits = precision - scale;
  if (fractionPart.length > scale) {
    throw new PersistenceValidationError(
      field,
      `supports at most ${scale} decimal places`,
    );
  }
  if (significantIntegerDigits > maxIntegerDigits) {
    throw new PersistenceValidationError(
      field,
      `supports at most ${maxIntegerDigits} integer digits`,
    );
  }

  const parsed = new Decimal(unsigned);
  if (!parsed.isFinite() || (positive ? parsed.lte(0) : parsed.lt(0))) {
    throw new PersistenceValidationError(
      field,
      positive ? "must be greater than zero" : "must be non-negative",
    );
  }
  return text;
}

function dateTime(value: unknown): string {
  const text = requiredText("transactionDate", value);
  if (!isoWithTimezonePattern.test(text) || Number.isNaN(Date.parse(text))) {
    throw new PersistenceValidationError(
      "transactionDate",
      "must be a valid ISO timestamp with timezone",
    );
  }
  return text;
}

export function validateAssetInput(
  input: CreateAssetInput | UpdateAssetInput,
  partial: boolean,
): CreateAssetInput | UpdateAssetInput {
  if (!partial || input.symbol !== undefined)
    input.symbol = requiredText("symbol", input.symbol);
  if (!partial || input.name !== undefined)
    input.name = requiredText("name", input.name);
  if (!partial || input.type !== undefined) {
    input.type = oneOf<AssetType>("type", input.type, [
      "STOCK",
      "ETF",
      "CRYPTO",
    ]);
  }
  if (!partial || input.provider !== undefined) {
    input.provider = oneOf<AssetProvider>("provider", input.provider, [
      "ALPACA",
      "COINGECKO",
    ]);
  }
  if (!partial || input.providerIdentifier !== undefined) {
    input.providerIdentifier = requiredText(
      "providerIdentifier",
      input.providerIdentifier,
    );
  }
  if (!partial || input.currency !== undefined)
    input.currency = currency(input.currency ?? "USD");
  if (input.exchange !== undefined)
    input.exchange = optionalText("exchange", input.exchange);

  if (input.type !== undefined && input.provider !== undefined) {
    providerMatchesType(input.type, input.provider);
  }
  return input;
}

export function validateTransactionInput(
  input: CreateTransactionInput | UpdateTransactionInput,
  partial: boolean,
): CreateTransactionInput | UpdateTransactionInput {
  if (input.id !== undefined) input.id = uuid("id", input.id);
  if (!partial || input.assetId !== undefined)
    input.assetId = uuid("assetId", input.assetId);
  if (!partial || input.type !== undefined) {
    input.type = oneOf<TransactionType>("type", input.type, ["BUY", "SELL"]);
  }
  if (!partial || input.quantity !== undefined) {
    input.quantity = decimal("quantity", input.quantity, 36, 18, true);
  }
  if (!partial || input.unitPrice !== undefined) {
    input.unitPrice = decimal("unitPrice", input.unitPrice, 30, 12, false);
  }
  if (!partial || input.transactionDate !== undefined) {
    input.transactionDate = dateTime(input.transactionDate);
  }
  if (!partial || input.currency !== undefined)
    input.currency = currency(input.currency ?? "USD");
  if (!partial || input.fees !== undefined) {
    const fees = decimal("fees", input.fees ?? "0", 30, 12, false);
    if (new Decimal(fees).isZero() === false) {
      throw new PersistenceValidationError("fees", "must be zero");
    }
    input.fees = fees;
  }
  if (input.notes !== undefined)
    input.notes = optionalText("notes", input.notes);
  return input;
}

export function validateId(field: string, value: string): string {
  return uuid(field, value);
}
