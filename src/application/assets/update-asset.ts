import type { Asset } from "../../domain/portfolio/types";
import {
  AssetDuplicateError,
  AssetNotFoundError,
  AssetValidationError,
} from "./errors";
import { resolveCreateIdentity } from "./resolve-asset";
import {
  normalizeAssetId,
  normalizeCreateAsset,
  normalizeUpdateAsset,
  providerForType,
} from "./validation";
import type {
  AssetProviderCatalog,
  AssetRepository,
  UpdateAssetCommand,
} from "./ports";

export class UpdateAsset {
  constructor(
    private readonly assets: AssetRepository,
    private readonly catalog?: AssetProviderCatalog,
  ) {}

  async execute(id: string, input: UpdateAssetCommand): Promise<Asset> {
    const assetId = normalizeAssetId(id);
    const current = await this.assets.getById(assetId);
    if (!current) throw new AssetNotFoundError(assetId);

    const changes = normalizeUpdateAsset(input);
    const type = changes.type ?? current.type;
    const provider = providerForType(type);
    const identityChanged =
      changes.type !== undefined ||
      changes.symbol !== undefined ||
      changes.providerIdentifier !== undefined ||
      changes.provider !== undefined;

    let identity: Awaited<ReturnType<typeof resolveCreateIdentity>> | null =
      null;

    if (identityChanged && this.catalog) {
      if (changes.providerIdentifier === undefined) {
        throw new AssetValidationError(
          "Seleccioná nuevamente el activo en el proveedor.",
          "providerIdentifier",
        );
      }
      identity = await resolveCreateIdentity(
        {
          ...current,
          ...changes,
          type,
          provider,
          providerIdentifier: changes.providerIdentifier,
        },
        this.catalog,
      );
    }

    const merged = normalizeCreateAsset(
      identity
        ? {
            ...current,
            ...changes,
            ...identity,
            type,
            provider,
            currency: "USD",
          }
        : {
            ...current,
            ...changes,
            type,
            provider,
            currency: "USD",
          },
    );
    const duplicate = await this.assets.findByProviderIdentifier(
      merged.provider,
      merged.providerIdentifier,
    );
    if (duplicate && duplicate.id !== assetId) {
      throw new AssetDuplicateError(merged.provider, merged.providerIdentifier);
    }

    const updated = await this.assets.update(assetId, merged);
    if (!updated) throw new AssetNotFoundError(assetId);
    return updated;
  }
}
