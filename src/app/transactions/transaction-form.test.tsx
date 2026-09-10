import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Asset } from "@/domain/portfolio";
import { localDateTimeToIso, TransactionForm } from "./transaction-form";

const asset: Asset = {
  id: "00000000-0000-4000-8000-000000000001",
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

describe("transaction form", () => {
  it("disables the form and explains the empty-assets state", () => {
    const markup = renderToStaticMarkup(<TransactionForm assets={[]} />);

    expect(markup).toContain("disabled");
    expect(markup).toContain("Todavía no hay activos disponibles");
  });

  it("renders the available asset and fixed MVP fields", () => {
    const markup = renderToStaticMarkup(<TransactionForm assets={[asset]} />);

    expect(markup).toContain("ACME — Acme Corp");
    expect(markup).toContain('value="0"');
    expect(markup).toContain('value="USD"');
    expect(markup).toContain("hasta 18 decimales");
  });

  it("converts a local date-time value into a timezone-aware ISO timestamp", () => {
    const iso = localDateTimeToIso("2026-09-10T18:30");

    expect(iso).toMatch(/^2026-09-10T\d{2}:30:00\.000Z$/);
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
  });
});
