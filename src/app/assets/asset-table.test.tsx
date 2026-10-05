// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Asset } from "@/domain/portfolio";
import { AssetTable } from "./asset-table";

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

vi.mock("./actions", () => ({
  deleteAssetAction: vi.fn(async () => ({
    status: "success",
    message: "ok",
    assetId: ASSET_ID,
  })),
  initialAssetActionState: { status: "idle" },
  createAssetAction: vi.fn(async () => ({ status: "idle" })),
  updateAssetAction: vi.fn(async () => ({
    status: "success",
    assetId: ASSET_ID,
  })),
}));

describe("asset table", () => {
  afterEach(() => cleanup());

  it("renders the empty state with a link to the form", () => {
    render(<AssetTable assets={[]} />);
    expect(screen.getByText("Todavía no hay activos")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Registrar un activo" })
        .getAttribute("href"),
    ).toBe("#asset-form");
  });

  it("renders columns, opens inline editor, and confirms deletion", async () => {
    const user = userEvent.setup();
    render(<AssetTable assets={[asset]} />);
    expect(screen.getAllByText("AAPL")).toHaveLength(2);
    expect(screen.getByText("Apple Inc.")).toBeTruthy();
    expect(screen.getByText("ALPACA")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByDisplayValue("Apple Inc.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByDisplayValue("Apple Inc.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText(/¿Eliminar este activo/)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy(),
    );
  });
});
