import type { AssetProvider, AssetType } from "../../domain/portfolio/types";
import { AssetValidationError } from "./errors";
import type {
  AssetFields,
  CreateAssetCommand,
  UpdateAssetCommand,
} from "./ports";

function fail(field: string, message: string): never {
  throw new AssetValidationError(`${field}: ${message}`, field);
}

function requiredText(field: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(field, "must be a non-empty string");
  }
  return value.trim();
}

function optionalText(field: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return fail(field, "must be a string");
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assetType(value: unknown): AssetType {
  if (value !== "STOCK" && value !== "ETF" && value !== "CRYPTO") {
    return fail("type", "must be one of STOCK, ETF, CRYPTO");
  }
  return value;
}

function assetProvider(value: unknown): AssetProvider {
  if (value !== "ALPACA" && value !== "COINGECKO") {
    return fail("provider", "must be one of ALPACA, COINGECKO");
  }
  return value;
}

export function normalizeProviderIdentifier(
  value: unknown,
  provider: AssetProvider,
): string {
  const identifier = requiredText("providerIdentifier", value);
  return provider === "COINGECKO"
    ? identifier.toLowerCase()
    : identifier.toUpperCase();
}

function providerForType(type: AssetType): AssetProvider {
  if (type === "CRYPTO") return "COINGECKO";
  if (type === "STOCK" || type === "ETF") return "ALPACA";
  throw new AssetValidationError(
    "type: must be one of STOCK, ETF, CRYPTO",
    "type",
  );
}

function validateProvider(type: AssetType, provider: AssetProvider): void {
  if (providerForType(type) !== provider) {
    return fail("provider", "does not match the selected asset type");
  }
}

function currency(value: unknown): string {
  const result = requiredText("currency", value ?? "USD");
  if (result !== "USD") return fail("currency", "must be USD");
  return result;
}

function normalizeFields(input: AssetFields): AssetFields {
  const type = assetType(input.type);
  const provider = assetProvider(input.provider ?? providerForType(type));
  validateProvider(type, provider);

  const exchange = optionalText("exchange", input.exchange);
  if (type !== "CRYPTO" && !exchange) {
    return fail("exchange", "is required for STOCK and ETF assets");
  }

  return {
    symbol: requiredText("symbol", input.symbol).toUpperCase(),
    name: requiredText("name", input.name),
    type,
    provider,
    providerIdentifier: normalizeProviderIdentifier(
      input.providerIdentifier,
      provider,
    ),
    currency: currency(input.currency),
    exchange,
  };
}

export function normalizeCreateAsset(input: CreateAssetCommand): AssetFields {
  return normalizeFields({
    ...input,
    symbol: input.symbol ?? "",
    name: input.name ?? "",
    provider: input.provider ?? providerForType(input.type),
  });
}

export function normalizeUpdateAsset(
  input: UpdateAssetCommand,
): UpdateAssetCommand {
  if (
    Object.keys(input).length === 0 ||
    !Object.values(input).some((value) => value !== undefined)
  ) {
    throw new AssetValidationError("At least one asset field must be updated.");
  }

  const result: UpdateAssetCommand = {};
  if (input.symbol !== undefined)
    result.symbol = requiredText("symbol", input.symbol).toUpperCase();
  if (input.name !== undefined) result.name = requiredText("name", input.name);
  if (input.type !== undefined) result.type = assetType(input.type);
  if (input.provider !== undefined)
    result.provider = assetProvider(input.provider);
  if (input.providerIdentifier !== undefined) {
    const identifier = requiredText(
      "providerIdentifier",
      input.providerIdentifier,
    );
    const provider =
      input.provider ??
      (input.type !== undefined ? providerForType(input.type) : undefined);
    result.providerIdentifier =
      provider === "COINGECKO"
        ? identifier.toLowerCase()
        : provider === "ALPACA"
          ? identifier.toUpperCase()
          : identifier;
  }
  if (input.currency !== undefined) result.currency = currency(input.currency);
  if (input.exchange !== undefined)
    result.exchange = optionalText("exchange", input.exchange);

  if (Object.keys(result).length === 0) {
    throw new AssetValidationError(
      "At least one supported asset field must be updated.",
    );
  }
  return result;
}

export function normalizeAssetId(value: unknown): string {
  const result = requiredText("id", value);
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(result)) return fail("id", "must be a valid UUID");
  return result.toLowerCase();
}

export { providerForType };
