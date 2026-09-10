import { Decimal } from "decimal.js";

import type {
  CreateTransactionCommand,
  CreateTransactionRecord,
  UpdateTransactionCommand,
} from "./ports";
import { TransactionValidationError } from "./errors";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoWithTimezonePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/;
const decimalPattern = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/;

function fail(field: string, message: string): never {
  throw new TransactionValidationError(`${field}: ${message}`, field);
}

function text(field: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(field, "must be a non-empty string");
  }
  return value.trim();
}

function optionalText(
  field: string,
  value: unknown,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  return text(field, value);
}

function uuid(field: string, value: unknown): string {
  const result = text(field, value);
  if (!uuidPattern.test(result)) return fail(field, "must be a valid UUID");
  return result.toLowerCase();
}

export function normalizeTransactionId(value: unknown): string {
  return uuid("id", value);
}

export function normalizeAssetId(value: unknown): string {
  return uuid("assetId", value);
}

function decimal(
  field: string,
  value: unknown,
  precision: number,
  scale: number,
  positive: boolean,
): string {
  const result = text(field, value);
  if (!decimalPattern.test(result))
    return fail(field, "must be a decimal string");

  const unsigned = result.startsWith("+") ? result.slice(1) : result;
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const significantIntegerDigits = integerPart.replace(/^0+/, "").length;
  if (fractionPart.length > scale) {
    return fail(field, `supports at most ${scale} decimal places`);
  }
  if (significantIntegerDigits > precision - scale) {
    return fail(field, `supports at most ${precision - scale} integer digits`);
  }

  const parsed = new Decimal(unsigned);
  if (!parsed.isFinite() || (positive ? parsed.lte(0) : parsed.lt(0))) {
    return fail(
      field,
      positive ? "must be greater than zero" : "must be non-negative",
    );
  }
  return result;
}

function dateTime(value: unknown): string {
  const result = text("transactionDate", value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(result);
  const year = match ? Number(match[1]) : NaN;
  const month = match ? Number(match[2]) : NaN;
  const day = match ? Number(match[3]) : NaN;
  const hour = match ? Number(match[4]) : NaN;
  const minute = match ? Number(match[5]) : NaN;
  const second = match ? Number(match[6]) : NaN;
  const daysInMonth =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 0;
  if (
    !isoWithTimezonePattern.test(result) ||
    Number.isNaN(Date.parse(result)) ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return fail(
      "transactionDate",
      "must be a valid ISO timestamp with timezone",
    );
  }
  // Persisted timestamps are returned as UTC ISO strings by the adapters.
  // Canonicalizing here also guarantees the candidate accepted by the domain
  // calculator uses its strict ISO-with-offset format.
  return new Date(result).toISOString();
}

function currency(value: unknown): string {
  const result = text("currency", value ?? "USD");
  if (result !== "USD") return fail("currency", "must be USD");
  return result;
}

function type(value: unknown): "BUY" | "SELL" {
  if (value !== "BUY" && value !== "SELL") {
    return fail("type", "must be one of BUY, SELL");
  }
  return value;
}

function fees(value: unknown): string {
  const result = decimal("fees", value ?? "0", 30, 12, false);
  if (!new Decimal(result).isZero()) return fail("fees", "must be zero");
  return result;
}

export function normalizeCreateTransaction(
  input: CreateTransactionCommand,
): Omit<CreateTransactionRecord, "id"> {
  return {
    assetId: uuid("assetId", input.assetId),
    type: type(input.type),
    quantity: decimal("quantity", input.quantity, 36, 18, true),
    unitPrice: decimal("unitPrice", input.unitPrice, 30, 12, false),
    transactionDate: dateTime(input.transactionDate),
    currency: currency(input.currency),
    fees: fees(input.fees),
    notes: optionalText("notes", input.notes) ?? null,
  };
}

export function normalizeUpdateTransaction(
  input: UpdateTransactionCommand,
): Partial<Omit<CreateTransactionRecord, "id">> {
  if (
    !Object.values(input).some((value) => value !== undefined) ||
    Object.keys(input).length === 0
  ) {
    throw new TransactionValidationError(
      "At least one transaction field must be updated.",
    );
  }

  type MutableFields = {
    -readonly [Key in keyof Omit<CreateTransactionRecord, "id">]?: Omit<
      CreateTransactionRecord,
      "id"
    >[Key];
  };
  const result: MutableFields = {};
  if (input.assetId !== undefined)
    result.assetId = uuid("assetId", input.assetId);
  if (input.type !== undefined) result.type = type(input.type);
  if (input.quantity !== undefined) {
    result.quantity = decimal("quantity", input.quantity, 36, 18, true);
  }
  if (input.unitPrice !== undefined) {
    result.unitPrice = decimal("unitPrice", input.unitPrice, 30, 12, false);
  }
  if (input.transactionDate !== undefined) {
    result.transactionDate = dateTime(input.transactionDate);
  }
  if (input.currency !== undefined) result.currency = currency(input.currency);
  if (input.fees !== undefined) result.fees = fees(input.fees);
  if (input.notes !== undefined) {
    result.notes = optionalText("notes", input.notes) ?? null;
  }
  if (Object.keys(result).length === 0) {
    throw new TransactionValidationError(
      "At least one supported transaction field must be updated.",
    );
  }
  return result;
}

export function normalizeTransactionRecord(
  input: CreateTransactionRecord,
): CreateTransactionRecord {
  const normalized = normalizeCreateTransaction(input);
  return { ...normalized, id: uuid("id", input.id) };
}
