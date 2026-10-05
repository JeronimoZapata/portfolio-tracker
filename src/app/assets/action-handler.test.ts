import { describe, expect, it, vi } from "vitest";

import type { Asset } from "@/domain/portfolio";
import {
  AssetDuplicateError,
  AssetInUseError,
  AssetValidationError,
} from "@/application/assets";
import {
  assetCommandFromFormData,
  runCreateAssetAction,
  runDeleteAssetAction,
  runUpdateAssetAction,
} from "./action-handler";

const ASSET_ID = "00000000-0000-4000-8000-000000000001";
const asset: Asset = {
  id: ASSET_ID,
  symbol: "AAPL",
  name: "Apple Inc.",
  type: "STOCK",
  provider: "ALPACA",
  providerIdentifier: "AAPL",
  currency: "USD",
  exchange: "NASDAQ",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function formData(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    symbol: " btc ",
    name: " Bitcoin ",
    type: "CRYPTO",
    providerIdentifier: " Bitcoin ",
    exchange: " ",
    assetId: ASSET_ID,
    ...overrides,
  })) {
    form.set(key, value);
  }
  return form;
}

describe("asset action handlers", () => {
  it("converts form data and derives provider and currency server-side", () => {
    expect(
      assetCommandFromFormData(
        formData({ provider: "ALPACA", currency: "EUR" }),
      ),
    ).toEqual({
      symbol: "btc",
      name: "Bitcoin",
      type: "CRYPTO",
      provider: "COINGECKO",
      providerIdentifier: "Bitcoin",
      currency: "USD",
      exchange: "",
    });
  });

  it("returns field errors and does not invalidate on validation failure", async () => {
    const invalidate = vi.fn();
    const result = await runCreateAssetAction(
      { status: "idle" },
      formData(),
      {
        execute: vi.fn(async () => {
          throw new AssetValidationError("name: required", "name");
        }),
      },
      invalidate,
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { name: "Ingresá un nombre válido." },
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("returns success and invalidates both pages after create and update", async () => {
    const invalidate = vi.fn();
    const create = await runCreateAssetAction(
      { status: "idle" },
      formData(),
      { execute: vi.fn(async () => asset) },
      invalidate,
    );
    const update = await runUpdateAssetAction(
      { status: "idle" },
      formData({
        type: "STOCK",
        providerIdentifier: "AAPL",
        exchange: "NASDAQ",
      }),
      { execute: vi.fn(async () => asset) },
      invalidate,
    );

    expect(create).toMatchObject({ status: "success", assetId: ASSET_ID });
    expect(update).toMatchObject({ status: "success", assetId: ASSET_ID });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("maps duplicate and in-use errors to clear Spanish messages", async () => {
    const duplicate = await runCreateAssetAction(
      { status: "idle" },
      formData(),
      {
        execute: vi.fn(async () => {
          throw new AssetDuplicateError("COINGECKO", "bitcoin");
        }),
      },
      vi.fn(),
    );
    const inUse = await runDeleteAssetAction(
      { status: "idle" },
      formData(),
      {
        execute: vi.fn(async () => {
          throw new AssetInUseError(ASSET_ID);
        }),
      },
      vi.fn(),
    );

    expect(duplicate.message).toContain("identificador");
    expect(duplicate.fieldErrors?.providerIdentifier).toContain("registrado");
    expect(inUse.message).toBe(
      "No se puede eliminar un activo que tiene operaciones.",
    );
  });
});
