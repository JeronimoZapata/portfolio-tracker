import { describe, expect, it } from "vitest";

import { toDomainAsset, toDomainTransaction } from "./mappers";
import type { AssetRow, TransactionRow } from "./schema";

const date = new Date("2025-01-02T03:04:05.678Z");

describe("database mappers", () => {
  it("maps an asset without changing provider identity", () => {
    const row: AssetRow = {
      id: "asset-id",
      symbol: "BTC",
      name: "Bitcoin",
      type: "CRYPTO",
      provider: "COINGECKO",
      providerIdentifier: "bitcoin",
      currency: "USD",
      exchange: null,
      createdAt: date,
      updatedAt: date,
    };

    expect(toDomainAsset(row)).toEqual({
      ...row,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  });

  it("preserves numeric strings and normalizes timestamps to ISO UTC", () => {
    const row: TransactionRow = {
      id: "transaction-id",
      assetId: "asset-id",
      type: "BUY",
      quantity: "0.000153820000000001",
      unitPrice: "12345.678901234567",
      currency: "USD",
      fees: "0",
      transactionDate: date,
      notes: null,
      createdAt: date,
      updatedAt: date,
    };

    const mapped = toDomainTransaction(row);
    expect(mapped.quantity).toBe(row.quantity);
    expect(mapped.unitPrice).toBe(row.unitPrice);
    expect(mapped.transactionDate).toBe(date.toISOString());
    expect(mapped.notes).toBeNull();
  });
});
