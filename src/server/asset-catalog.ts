import "./server-only";

import {
  AlpacaAssetCatalog,
  CoinGeckoAssetCatalog,
  CompositeAssetCatalog,
} from "@/integrations/asset-catalog";

let catalog: ReturnType<typeof createAssetCatalog> | undefined;

function createAssetCatalog() {
  return new CompositeAssetCatalog(
    new AlpacaAssetCatalog(
      process.env.ALPACA_API_KEY ?? "",
      process.env.ALPACA_API_SECRET ?? "",
    ),
    new CoinGeckoAssetCatalog(process.env.COINGECKO_API_KEY ?? ""),
  );
}

export function getAssetCatalog() {
  catalog ??= createAssetCatalog();
  return catalog;
}
