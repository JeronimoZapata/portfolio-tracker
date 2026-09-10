import type { Asset } from "../../domain/portfolio/types";

export interface AssetCatalog {
  list(): Promise<Asset[]>;
}
