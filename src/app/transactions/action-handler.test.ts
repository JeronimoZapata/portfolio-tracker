import { describe, expect, it, vi } from "vitest";

import {
  runCreateTransactionAction,
  transactionCommandFromFormData,
  type TransactionActionState,
} from "./action-handler";
import {
  AssetNotFoundError,
  TransactionValidationError,
} from "@/application/transactions";
import { OversellError } from "@/domain/portfolio";

const ASSET_ID = "00000000-0000-4000-8000-000000000001";
const TRANSACTION_ID = "00000000-0000-4000-8000-000000000002";
const baseState: TransactionActionState = { status: "idle" };

function formData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("assetId", overrides.assetId ?? ASSET_ID);
  form.set("type", overrides.type ?? "BUY");
  form.set("quantity", overrides.quantity ?? "0.00015382");
  form.set("unitPrice", overrides.unitPrice ?? "123.45");
  form.set(
    "transactionDate",
    overrides.transactionDate ?? "2026-09-10T18:00:00.000Z",
  );
  form.set("notes", overrides.notes ?? "  compra periódica  ");
  return form;
}

function createdTransaction() {
  return {
    id: TRANSACTION_ID,
    assetId: ASSET_ID,
    type: "BUY" as const,
    quantity: "0.00015382",
    unitPrice: "123.45",
    fees: "0",
    currency: "USD",
    transactionDate: "2026-09-10T18:00:00.000Z",
    notes: "compra periódica",
    createdAt: "2026-09-10T18:00:00.000Z",
    updatedAt: "2026-09-10T18:00:00.000Z",
  };
}

describe("transaction form action handler", () => {
  it("maps FormData to a decimal-safe CreateTransaction command", () => {
    expect(transactionCommandFromFormData(formData())).toEqual({
      assetId: ASSET_ID,
      type: "BUY",
      quantity: "0.00015382",
      unitPrice: "123.45",
      transactionDate: "2026-09-10T18:00:00.000Z",
      currency: "USD",
      fees: "0",
      notes: "compra periódica",
    });
    expect(
      transactionCommandFromFormData(formData({ notes: "   " })).notes,
    ).toBeNull();
  });

  it("returns success and revalidates only after the write succeeds", async () => {
    const execute = vi.fn(async () => createdTransaction());
    const invalidate = vi.fn();

    const result = await runCreateTransactionAction(
      baseState,
      formData(),
      { execute },
      invalidate,
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD", fees: "0" }),
    );
    expect(invalidate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "success",
      transactionId: TRANSACTION_ID,
    });
  });

  it("translates required-field validation errors", async () => {
    const execute = vi.fn(async () => {
      throw new TransactionValidationError(
        "quantity: must be a non-empty string",
        "quantity",
      );
    });
    const result = await runCreateTransactionAction(
      baseState,
      formData({ quantity: "" }),
      { execute },
      vi.fn(),
    );

    expect(result).toEqual({
      status: "error",
      message:
        "Ingresá una cantidad mayor que cero, con formato decimal válido.",
      fieldErrors: {
        quantity:
          "Ingresá una cantidad mayor que cero, con formato decimal válido.",
      },
    });
  });

  it("translates missing assets, overselling, and hides internal errors", async () => {
    const missingAsset = await runCreateTransactionAction(
      baseState,
      formData(),
      {
        execute: vi.fn(async () => {
          throw new AssetNotFoundError(ASSET_ID);
        }),
      },
      vi.fn(),
    );
    expect(missingAsset.message).toBe(
      "El activo seleccionado ya no está disponible.",
    );

    const oversell = await runCreateTransactionAction(
      baseState,
      formData({ type: "SELL" }),
      {
        execute: vi.fn(async () => {
          throw new OversellError(TRANSACTION_ID, "2", "1");
        }),
      },
      vi.fn(),
    );
    expect(oversell.message).toBe(
      "La venta supera la posición disponible para este activo.",
    );

    const internal = await runCreateTransactionAction(
      baseState,
      formData(),
      {
        execute: vi.fn(async () => {
          throw new Error("postgres password");
        }),
      },
      vi.fn(),
    );
    expect(internal).toEqual({
      status: "error",
      message: "No pudimos guardar la operación. Intentá nuevamente.",
    });
  });
});
