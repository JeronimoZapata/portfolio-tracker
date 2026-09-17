// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Asset, Transaction } from "@/domain/portfolio";
import type { DeleteTransactionActionState } from "./action-handler";
import { TransactionTable } from "./transaction-table";

const ASSET_ID = "00000000-0000-4000-8000-000000000001";
const TRANSACTION_ID = "00000000-0000-4000-8000-000000000002";
const asset: Asset = {
  id: ASSET_ID,
  symbol: "ACME",
  name: "Acme Corp",
  type: "STOCK",
  provider: "ALPACA",
  providerIdentifier: "ACME",
  currency: "USD",
  exchange: "NYSE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const transaction: Transaction = {
  id: TRANSACTION_ID,
  assetId: ASSET_ID,
  type: "BUY",
  quantity: "2",
  unitPrice: "10.50",
  currency: "USD",
  fees: "0",
  transactionDate: "2026-09-10T18:00:00.000Z",
  notes: "Compra periódica",
  createdAt: "2026-09-10T18:00:00.000Z",
  updatedAt: "2026-09-10T18:00:00.000Z",
};

vi.mock("./actions", () => ({
  initialTransactionActionState: { status: "idle" },
  createTransactionAction: vi.fn(async () => ({ status: "idle" })),
  updateTransactionAction: vi.fn(async () => ({
    status: "success",
    message: "ok",
    transactionId: TRANSACTION_ID,
  })),
  deleteTransactionAction: vi.fn(async () => ({
    status: "success",
    message: "ok",
    transactionId: TRANSACTION_ID,
  })),
}));

function renderTable() {
  return render(
    <TransactionTable rows={[{ transaction, asset }]} assets={[asset]} />,
  );
}

describe("transaction table interactions", () => {
  afterEach(() => cleanup());
  it("opens the editor with the selected values and closes it on cancel", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(screen.getByDisplayValue("10.50")).toBeTruthy();
    expect(screen.getByDisplayValue("Compra periódica")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByDisplayValue("10.50")).toBeNull();
  });

  it("closes the editor after a successful save", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Guardar cambios" }),
      ).toBeNull(),
    );
  });

  it("requires inline delete confirmation and disables controls while pending", async () => {
    let resolveDelete:
      | ((
          value:
            | DeleteTransactionActionState
            | PromiseLike<DeleteTransactionActionState>,
        ) => void)
      | undefined;
    const actions = await import("./actions");
    vi.mocked(actions.deleteTransactionAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText(/¿Eliminar esta operación/)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );
    expect(
      (screen.getByRole("button", { name: "Eliminando…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    resolveDelete?.({
      status: "success",
      message: "ok",
      transactionId: TRANSACTION_ID,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy(),
    );
  });
});
