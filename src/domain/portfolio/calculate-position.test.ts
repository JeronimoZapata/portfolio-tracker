import { describe, expect, it } from "vitest";

import {
  calculatePosition,
  InvalidMarketPriceError,
  InvalidTransactionError,
  OversellError,
} from "./index";
import type { PortfolioTransaction } from "./types";

const date = "2024-01-01T00:00:00.000Z";

function transaction(
  overrides: Partial<PortfolioTransaction> = {},
): PortfolioTransaction {
  return {
    id: "transaction",
    type: "BUY",
    quantity: "1",
    unitPrice: "10",
    fees: "0",
    transactionDate: date,
    ...overrides,
  };
}

describe("calculatePosition", () => {
  it("returns a zero position for an empty ledger", () => {
    expect(calculatePosition([])).toEqual({
      quantity: "0",
      averageCost: "0",
      remainingCostBasis: "0",
      realizedProfitLoss: "0",
    });
  });

  it("calculates one purchase", () => {
    expect(
      calculatePosition([
        transaction({ id: "buy", quantity: "2", unitPrice: "10" }),
      ]),
    ).toEqual({
      quantity: "2",
      averageCost: "10",
      remainingCostBasis: "20",
      realizedProfitLoss: "0",
    });
  });

  it("calculates a weighted average across purchases", () => {
    expect(
      calculatePosition([
        transaction({ id: "first", quantity: "2", unitPrice: "10" }),
        transaction({
          id: "second",
          quantity: "3",
          unitPrice: "20",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
      ]),
    ).toMatchObject({
      quantity: "5",
      averageCost: "16",
      remainingCostBasis: "80",
    });
  });

  it("keeps the pre-sale average for a partial sale", () => {
    expect(
      calculatePosition([
        transaction({ id: "buy-a", quantity: "2", unitPrice: "10" }),
        transaction({
          id: "buy-b",
          quantity: "3",
          unitPrice: "20",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
        transaction({
          id: "sell",
          type: "SELL",
          quantity: "2",
          unitPrice: "25",
          transactionDate: "2024-01-03T00:00:00.000Z",
        }),
      ]),
    ).toEqual({
      quantity: "3",
      averageCost: "16",
      remainingCostBasis: "48",
      realizedProfitLoss: "18",
    });
  });

  it("closes a position and normalizes its remaining values to zero", () => {
    expect(
      calculatePosition([
        transaction({ id: "buy", quantity: "5", unitPrice: "10" }),
        transaction({
          id: "sell",
          type: "SELL",
          quantity: "5",
          unitPrice: "12",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
      ]),
    ).toEqual({
      quantity: "0",
      averageCost: "0",
      remainingCostBasis: "0",
      realizedProfitLoss: "10",
    });
  });

  it("supports several buy and sell cycles", () => {
    expect(
      calculatePosition([
        transaction({ id: "buy-a", quantity: "2", unitPrice: "10" }),
        transaction({
          id: "sell-a",
          type: "SELL",
          quantity: "1",
          unitPrice: "15",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
        transaction({
          id: "buy-b",
          quantity: "4",
          unitPrice: "20",
          transactionDate: "2024-01-03T00:00:00.000Z",
        }),
        transaction({
          id: "sell-b",
          type: "SELL",
          quantity: "2",
          unitPrice: "25",
          transactionDate: "2024-01-04T00:00:00.000Z",
        }),
      ]),
    ).toEqual({
      quantity: "3",
      averageCost: "18",
      remainingCostBasis: "54",
      realizedProfitLoss: "19",
    });
  });

  it("calculates market value and unrealized metrics", () => {
    expect(
      calculatePosition(
        [transaction({ id: "buy", quantity: "5", unitPrice: "16" })],
        "20",
      ),
    ).toEqual({
      quantity: "5",
      averageCost: "16",
      remainingCostBasis: "80",
      realizedProfitLoss: "0",
      marketPrice: "20",
      marketValue: "100",
      unrealizedProfitLoss: "20",
      unrealizedReturnPercentage: "25",
      totalProfitLoss: "20",
    });
  });

  it("returns a null percentage for a closed position", () => {
    const result = calculatePosition(
      [
        transaction({ id: "buy", quantity: "2", unitPrice: "10" }),
        transaction({
          id: "sell",
          type: "SELL",
          quantity: "2",
          unitPrice: "15",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
      ],
      "20",
    );

    expect(result.unrealizedReturnPercentage).toBeNull();
    expect(result.marketValue).toBe("0");
    expect(result.unrealizedProfitLoss).toBe("0");
    expect(result.totalProfitLoss).toBe("10");
  });

  it("returns a null percentage when an open position has zero cost basis", () => {
    const result = calculatePosition(
      [transaction({ id: "free-buy", quantity: "2", unitPrice: "0" })],
      "5",
    );

    expect(result.remainingCostBasis).toBe("0");
    expect(result.marketValue).toBe("10");
    expect(result.unrealizedProfitLoss).toBe("10");
    expect(result.unrealizedReturnPercentage).toBeNull();
  });

  it("preserves high precision quantities for crypto assets", () => {
    expect(
      calculatePosition([
        transaction({
          id: "crypto-buy",
          quantity: "0.00015382",
          unitPrice: "30000",
        }),
      ]),
    ).toMatchObject({
      quantity: "0.00015382",
      averageCost: "30000",
      remainingCostBasis: "4.6146",
    });
  });

  it("sorts by date and then by ID regardless of input order", () => {
    const result = calculatePosition([
      transaction({
        id: "b-sell",
        type: "SELL",
        quantity: "1",
        unitPrice: "20",
      }),
      transaction({ id: "a-buy", quantity: "2", unitPrice: "10" }),
    ]);

    expect(result.quantity).toBe("1");
    expect(result.realizedProfitLoss).toBe("10");
  });

  it("rejects a sale that exceeds the available quantity", () => {
    expect(() =>
      calculatePosition([
        transaction({
          id: "sell",
          type: "SELL",
          quantity: "2",
        }),
      ]),
    ).toThrowError(OversellError);
  });

  it.each([
    ["quantity", { quantity: "0" }],
    ["negative quantity", { quantity: "-1" }],
    ["negative price", { unitPrice: "-1" }],
    ["invalid quantity", { quantity: "not-a-number" }],
    ["invalid date", { transactionDate: "2024-13-99" }],
    ["non-zero positive fee", { fees: "1" }],
    ["non-zero negative fee", { fees: "-1" }],
  ])("rejects invalid %s", (_, overrides) => {
    expect(() => calculatePosition([transaction(overrides)])).toThrowError(
      InvalidTransactionError,
    );
  });

  it("accepts an explicit zero fee without changing the result", () => {
    expect(
      calculatePosition([transaction({ fees: "0.000" })]).remainingCostBasis,
    ).toBe("10");
  });

  it("does not round a repeating weighted average to a display scale", () => {
    const result = calculatePosition([
      transaction({ id: "one", quantity: "1", unitPrice: "1" }),
      transaction({
        id: "two",
        quantity: "2",
        unitPrice: "2",
        transactionDate: "2024-01-02T00:00:00.000Z",
      }),
    ]);

    expect(result.averageCost).toMatch(/^1\.666666666666666666666666/);
    expect(result.averageCost).not.toBe("1.67");
  });

  it("rejects duplicate transaction IDs", () => {
    expect(() =>
      calculatePosition([
        transaction({ id: "duplicate" }),
        transaction({
          id: "duplicate",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
      ]),
    ).toThrowError(InvalidTransactionError);
  });

  it.each(["not-a-number", "-1"])(
    "rejects invalid market price %s",
    (marketPrice) => {
      expect(() => calculatePosition([], marketPrice)).toThrowError(
        InvalidMarketPriceError,
      );
    },
  );

  it("starts a new average-cost cycle after a full close", () => {
    expect(
      calculatePosition([
        transaction({ id: "buy-a", quantity: "2", unitPrice: "10" }),
        transaction({
          id: "sell-a",
          type: "SELL",
          quantity: "2",
          unitPrice: "20",
          transactionDate: "2024-01-02T00:00:00.000Z",
        }),
        transaction({
          id: "buy-b",
          quantity: "1",
          unitPrice: "30",
          transactionDate: "2024-01-03T00:00:00.000Z",
        }),
      ]),
    ).toMatchObject({
      quantity: "1",
      averageCost: "30",
      remainingCostBasis: "30",
      realizedProfitLoss: "20",
    });
  });
});
