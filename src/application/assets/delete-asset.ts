import type { Asset } from "../../domain/portfolio/types";
import { AssetInUseError, AssetNotFoundError } from "./errors";
import { normalizeAssetId } from "./validation";
import type { AssetRepository, AssetUsageReader } from "./ports";

export class DeleteAsset {
  constructor(
    private readonly assets: AssetRepository,
    private readonly usage: AssetUsageReader,
  ) {}

  async execute(id: string): Promise<Asset> {
    const assetId = normalizeAssetId(id);
    const current = await this.assets.getById(assetId);
    if (!current) throw new AssetNotFoundError(assetId);
    if (await this.usage.hasTransactions(assetId)) {
      throw new AssetInUseError(assetId);
    }
    if (!(await this.assets.delete(assetId))) {
      throw new AssetNotFoundError(assetId);
    }
    return current;
  }
}
