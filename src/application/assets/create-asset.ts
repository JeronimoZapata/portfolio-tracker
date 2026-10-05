import type { Asset } from "../../domain/portfolio/types";
import { AssetDuplicateError } from "./errors";
import { resolveCreateIdentity } from "./resolve-asset";
import { normalizeCreateAsset, providerForType } from "./validation";
import type {
  AssetProviderCatalog,
  AssetRepository,
  CreateAssetCommand,
} from "./ports";

export class CreateAsset {
  constructor(
    private readonly assets: AssetRepository,
    private readonly catalog?: AssetProviderCatalog,
  ) {}

  async execute(input: CreateAssetCommand): Promise<Asset> {
    // Keep direct application callers honest. The production server always
    // supplies a catalog and derives the provider from the type, while this
    // check preserves the application contract for catalog-free callers.
    if (
      !this.catalog &&
      input.provider !== undefined &&
      input.provider !== providerForType(input.type)
    ) {
      normalizeCreateAsset(input);
    }
    const identity = await resolveCreateIdentity(input, this.catalog);
    const normalized = normalizeCreateAsset({
      ...input,
      ...identity,
      provider: identity.provider,
      currency: "USD",
    });
    const existing = await this.assets.findByProviderIdentifier(
      normalized.provider,
      normalized.providerIdentifier,
    );
    if (existing) {
      throw new AssetDuplicateError(
        normalized.provider,
        normalized.providerIdentifier,
      );
    }
    return this.assets.create(normalized);
  }
}
