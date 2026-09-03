import Decimal from "decimal.js";

import {
  InvalidMarketPriceError,
  InvalidTransactionError,
  OversellError,
} from "./errors";
import type {
  DecimalInput,
  PortfolioTransaction,
  PositionResult,
  ValuedPositionResult,
} from "./types";

// The domain never rounds to a display scale. This precision only bounds the
// representation of non-terminating decimal divisions such as a repeating
// weighted average.
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

const ZERO = new Decimal(0);
const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseIsoTimestamp(value: string): number | undefined {
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function parseDecimal(value: DecimalInput, field: string): Decimal {
  if (typeof value !== "string") {
    throw new InvalidTransactionError(`${field} must be a decimal string.`);
  }

  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new InvalidTransactionError(`${field} must be a finite decimal.`);
  }
  if (!parsed.isFinite()) {
    throw new InvalidTransactionError(`${field} must be a finite decimal.`);
  }

  return parsed;
}

function serialize(value: Decimal): string {
  return value.isZero() ? "0" : value.toFixed();
}

function validateTransactions(
  transactions: readonly PortfolioTransaction[],
): readonly (PortfolioTransaction & {
  readonly parsedQuantity: Decimal;
  readonly parsedUnitPrice: Decimal;
  readonly parsedFees: Decimal;
  readonly timestamp: number;
})[] {
  const ids = new Set<string>();

  return transactions.map((transaction) => {
    if (
      typeof transaction.id !== "string" ||
      !transaction.id.trim() ||
      ids.has(transaction.id)
    ) {
      throw new InvalidTransactionError(
        `Transaction IDs must be non-empty and unique: ${transaction.id}.`,
      );
    }
    ids.add(transaction.id);

    if (transaction.type !== "BUY" && transaction.type !== "SELL") {
      throw new InvalidTransactionError(
        `Transaction ${transaction.id} has an unsupported type.`,
      );
    }

    const parsedQuantity = parseDecimal(transaction.quantity, "quantity");
    const parsedUnitPrice = parseDecimal(transaction.unitPrice, "unitPrice");
    const parsedFees = parseDecimal(transaction.fees, "fees");

    if (!parsedQuantity.gt(ZERO)) {
      throw new InvalidTransactionError(
        `Transaction ${transaction.id} quantity must be greater than zero.`,
      );
    }
    if (parsedUnitPrice.lt(ZERO)) {
      throw new InvalidTransactionError(
        `Transaction ${transaction.id} unitPrice cannot be negative.`,
      );
    }
    if (!parsedFees.isZero()) {
      throw new InvalidTransactionError(
        `Transaction ${transaction.id} fees must be zero in the MVP.`,
      );
    }

    const timestamp =
      typeof transaction.transactionDate === "string"
        ? parseIsoTimestamp(transaction.transactionDate)
        : undefined;
    if (timestamp === undefined) {
      throw new InvalidTransactionError(
        `Transaction ${transaction.id} transactionDate must be a valid ISO timestamp.`,
      );
    }

    return {
      ...transaction,
      parsedQuantity,
      parsedUnitPrice,
      parsedFees,
      timestamp,
    };
  });
}

function validateMarketPrice(marketPrice: DecimalInput): Decimal {
  if (typeof marketPrice !== "string") {
    throw new InvalidMarketPriceError("marketPrice must be a decimal string.");
  }

  let parsed: Decimal;
  try {
    parsed = new Decimal(marketPrice);
  } catch {
    throw new InvalidMarketPriceError(
      "marketPrice must be a finite, non-negative decimal.",
    );
  }
  if (!parsed.isFinite() || parsed.lt(ZERO)) {
    throw new InvalidMarketPriceError(
      "marketPrice must be a finite, non-negative decimal.",
    );
  }

  return parsed;
}

function calculateBasePosition(
  transactions: readonly PortfolioTransaction[],
): PositionResult {
  const orderedTransactions = [...validateTransactions(transactions)].sort(
    (left, right) =>
      left.timestamp - right.timestamp ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );

  let quantity = ZERO;
  let remainingCostBasis = ZERO;
  let realizedProfitLoss = ZERO;

  for (const transaction of orderedTransactions) {
    const transactionQuantity = transaction.parsedQuantity;

    if (transaction.type === "BUY") {
      quantity = quantity.plus(transactionQuantity);
      remainingCostBasis = remainingCostBasis.plus(
        transactionQuantity.times(transaction.parsedUnitPrice),
      );
      continue;
    }

    if (transactionQuantity.gt(quantity)) {
      throw new OversellError(
        transaction.id,
        serialize(transactionQuantity),
        serialize(quantity),
      );
    }

    const averageCost = remainingCostBasis.dividedBy(quantity);
    const costDischarged = transactionQuantity.times(averageCost);
    realizedProfitLoss = realizedProfitLoss.plus(
      transactionQuantity
        .times(transaction.parsedUnitPrice)
        .minus(costDischarged),
    );
    quantity = quantity.minus(transactionQuantity);
    remainingCostBasis = remainingCostBasis.minus(costDischarged);

    if (quantity.isZero()) {
      quantity = ZERO;
      remainingCostBasis = ZERO;
    }
  }

  const averageCost = quantity.isZero()
    ? ZERO
    : remainingCostBasis.dividedBy(quantity);

  return {
    quantity: serialize(quantity),
    averageCost: serialize(averageCost),
    remainingCostBasis: serialize(remainingCostBasis),
    realizedProfitLoss: serialize(realizedProfitLoss),
  };
}

export function calculatePosition(
  transactions: readonly PortfolioTransaction[],
): PositionResult;
export function calculatePosition(
  transactions: readonly PortfolioTransaction[],
  marketPrice: DecimalInput,
): ValuedPositionResult;
export function calculatePosition(
  transactions: readonly PortfolioTransaction[],
  marketPrice?: DecimalInput,
): PositionResult | ValuedPositionResult {
  const parsedMarketPrice =
    marketPrice === undefined ? undefined : validateMarketPrice(marketPrice);
  const basePosition = calculateBasePosition(transactions);

  if (parsedMarketPrice === undefined) {
    return basePosition;
  }

  const quantity = new Decimal(basePosition.quantity);
  const remainingCostBasis = new Decimal(basePosition.remainingCostBasis);
  const realizedProfitLoss = new Decimal(basePosition.realizedProfitLoss);
  const marketValue = quantity.times(parsedMarketPrice);
  const unrealizedProfitLoss = marketValue.minus(remainingCostBasis);

  return {
    ...basePosition,
    marketPrice: serialize(parsedMarketPrice),
    marketValue: serialize(marketValue),
    unrealizedProfitLoss: serialize(unrealizedProfitLoss),
    unrealizedReturnPercentage: remainingCostBasis.isZero()
      ? null
      : serialize(
          unrealizedProfitLoss.dividedBy(remainingCostBasis).times(100),
        ),
    totalProfitLoss: serialize(realizedProfitLoss.plus(unrealizedProfitLoss)),
  };
}
