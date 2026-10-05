// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Asset } from "@/domain/portfolio";
import { AssetForm, EditAssetForm } from "./asset-form";

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
  initialAssetActionState: { status: "idle" },
  createAssetAction: vi.fn(async () => ({ status: "idle" })),
  updateAssetAction: vi.fn(async () => ({
    status: "success",
    message: "ok",
    assetId: ASSET_ID,
  })),
}));

describe("asset form", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("searches the selected provider and stores the selected CoinGecko id", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  provider: "COINGECKO",
                  providerIdentifier: "bitcoin",
                  symbol: "BTC",
                  name: "Bitcoin",
                  exchange: null,
                  marketCapRank: 1,
                },
              ],
            }),
          ),
      ),
    );

    render(<AssetForm />);
    await user.selectOptions(screen.getByLabelText("Tipo"), "CRYPTO");
    await user.type(
      screen.getByLabelText("Buscar activo en COINGECKO"),
      "bitcoin",
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole("option", { name: /Bitcoin \(BTC\)/ }),
        ).toBeTruthy(),
      {
        timeout: 1_000,
      },
    );
    await user.click(screen.getByRole("option", { name: /Bitcoin \(BTC\)/ }));

    expect(screen.getByLabelText("Símbolo").getAttribute("value")).toBe("BTC");
    expect(screen.getByDisplayValue("Bitcoin")).toBeTruthy();
    const identifierInput = document.querySelector(
      'input[name="providerIdentifier"]',
    );
    expect(identifierInput?.getAttribute("value")).toBe("bitcoin");
  });

  it("renders fixed currency and derives Alpaca by default", () => {
    render(<AssetForm />);
    expect(screen.getByDisplayValue("ALPACA")).toBeTruthy();
    expect(screen.getByDisplayValue("USD")).toBeTruthy();
    expect(screen.getByDisplayValue("ALPACA").getAttribute("name")).toBeNull();
    expect(screen.getByDisplayValue("USD").getAttribute("name")).toBeNull();
  });

  it("changes the derived provider and exchange requirement for crypto", async () => {
    const user = userEvent.setup();
    render(<AssetForm />);
    await user.selectOptions(screen.getByLabelText("Tipo"), "CRYPTO");

    expect(screen.getByDisplayValue("COINGECKO")).toBeTruthy();
    expect(screen.getByLabelText(/Exchange/).hasAttribute("required")).toBe(
      false,
    );
  });

  it("hydrates current values in edit mode", () => {
    render(<EditAssetForm asset={asset} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Símbolo").getAttribute("value")).toBe("AAPL");
    expect(screen.getByDisplayValue("Apple Inc.")).toBeTruthy();
    expect(screen.getByDisplayValue("NASDAQ")).toBeTruthy();
    expect(screen.getByDisplayValue("ALPACA")).toBeTruthy();
  });
});
