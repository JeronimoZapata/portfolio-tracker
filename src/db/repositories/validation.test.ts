import { describe, expect, it } from "vitest";

import {
  PersistenceValidationError,
  validateAssetInput,
  validateTransactionInput,
} from "./validation";

const validAsset = {
  symbol: "BTC",
  name: "Bitcoin",
  type: "CRYPTO" as const,
  provider: "COINGECKO" as const,
  providerIdentifier: "bitcoin",
};

const validTransaction = {
  assetId: "00000000-0000-4000-8000-000000000001",
  type: "BUY" as const,
  quantity: "0.000153820000000001",
  unitPrice: "12345.678901234567",
  transactionDate: "2025-01-01T00:00:00.000Z",
};

function expectInvalid(action: () => unknown, field: string) {
  expect(action).toThrow(PersistenceValidationError);
  expect(action).toThrow(new RegExp(`^${field}:`));
}

describe("persistence input validation", () => {
  it("accepts provider-specific assets and defaults USD", () => {
    expect(validateAssetInput({ ...validAsset }, false)).toMatchObject({
      ...validAsset,
      currency: "USD",
    });
  });

  it("rejects empty fields and mismatched providers", () => {
    expectInvalid(
      () => validateAssetInput({ ...validAsset, symbol: " " }, false),
      "symbol",
    );
    expectInvalid(
      () =>
        validateAssetInput(
          { ...validAsset, type: "STOCK", provider: "COINGECKO" },
          false,
        ),
      "provider",
    );
  });

  it("rejects invalid transaction values before SQL", () => {
    expectInvalid(
      () =>
        validateTransactionInput({ ...validTransaction, quantity: "0" }, false),
      "quantity",
    );
    expectInvalid(
      () =>
        validateTransactionInput(
          { ...validTransaction, unitPrice: "-1" },
          false,
        ),
      "unitPrice",
    );
    expectInvalid(
      () =>
        validateTransactionInput({ ...validTransaction, fees: "0.01" }, false),
      "fees",
    );
    expectInvalid(
      () =>
        validateTransactionInput(
          { ...validTransaction, quantity: "1.1234567890123456789" },
          false,
        ),
      "quantity",
    );
    expectInvalid(
      () =>
        validateTransactionInput(
          { ...validTransaction, transactionDate: "2025-01-01" },
          false,
        ),
      "transactionDate",
    );
  });

  it("keeps decimal strings exact at the supported precision", () => {
    const result = validateTransactionInput({ ...validTransaction }, false);
    expect(result.quantity).toBe(validTransaction.quantity);
    expect(result.unitPrice).toBe(validTransaction.unitPrice);
  });
});
