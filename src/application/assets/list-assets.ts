import type { Asset } from "../../domain/portfolio/types";
import type { AssetCatalog } from "./ports";

export class ListAssets {
  constructor(private readonly assets: AssetCatalog) {}

  async execute(): Promise<Asset[]> {
    return this.assets.list();
  }
}
