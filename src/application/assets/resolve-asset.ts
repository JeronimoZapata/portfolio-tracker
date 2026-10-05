import type { AssetType } from "../../domain/portfolio/types";
import { AssetResolutionError } from "./errors";
import type {
  AssetProviderCatalog,
  CreateAssetCommand,
  ProviderAssetCandidate,
} from "./ports";
import { normalizeProviderIdentifier, providerForType } from "./validation";

function providerCatalogCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function resolutionError(error: unknown): AssetResolutionError {
  if (error instanceof AssetResolutionError) return error;
  if (providerCatalogCode(error) === "PROVIDER_NOT_FOUND") {
    return new AssetResolutionError(
      "El activo seleccionado no existe en el proveedor.",
      "not-found",
    );
  }
  return new AssetResolutionError(
    "No pudimos verificar el activo con el proveedor. Intentá nuevamente.",
    "unavailable",
  );
}

export async function resolveCreateIdentity(
  input: CreateAssetCommand,
  catalog?: AssetProviderCatalog,
): Promise<{
  type: AssetType;
  provider: ProviderAssetCandidate["provider"];
  providerIdentifier: string;
  symbol: string;
  name: string;
  exchange: string | null | undefined;
}> {
  const type = input.type;
  const provider = providerForType(type);
  const providerIdentifier = normalizeProviderIdentifier(
    input.providerIdentifier,
    provider,
  );

  if (!catalog) {
    return {
      type,
      provider,
      providerIdentifier,
      symbol: input.symbol ?? "",
      name: input.name ?? "",
      exchange: input.exchange,
    };
  }

  let resolved: ProviderAssetCandidate;
  try {
    resolved = await catalog.resolve(type, providerIdentifier);
  } catch (error) {
    throw resolutionError(error);
  }

  if (resolved.provider !== provider) {
    throw new AssetResolutionError(
      "El activo seleccionado no corresponde al proveedor del tipo elegido.",
      "not-found",
    );
  }

  return {
    type,
    provider,
    providerIdentifier: resolved.providerIdentifier,
    symbol: resolved.symbol,
    name: input.name ?? resolved.name,
    exchange:
      input.exchange === undefined
        ? resolved.exchange
        : (input.exchange ?? null),
  };
}
