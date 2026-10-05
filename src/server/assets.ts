import "./server-only";

import {
  CreateAsset,
  DeleteAsset,
  ListAssets,
  UpdateAsset,
} from "@/application";
import type { Asset } from "@/domain/portfolio";

export async function getAssetServices() {
  const { db } = await import("@/db");
  const { DrizzleAssetRepository, DrizzleTransactionRepository } =
    await import("@/db/repositories");

  const assets = new DrizzleAssetRepository(db);
  const { getAssetCatalog } = await import("@/server/asset-catalog");
  const assetCatalog = getAssetCatalog();
  const transactions = new DrizzleTransactionRepository(db);
  const usage = {
    hasTransactions: async (assetId: string) =>
      (await transactions.list({ assetId })).length > 0,
  };

  return {
    listAssets: new ListAssets(assets),
    createAsset: new CreateAsset(assets, assetCatalog),
    updateAsset: new UpdateAsset(assets, assetCatalog),
    deleteAsset: new DeleteAsset(assets, usage),
  };
}

export async function loadAssetsPage(): Promise<Asset[]> {
  const services = await getAssetServices();
  return services.listAssets.execute();
}
