export type AssetApplicationErrorCode =
  | "ASSET_VALIDATION"
  | "ASSET_NOT_FOUND"
  | "ASSET_DUPLICATE"
  | "ASSET_IN_USE"
  | "ASSET_RESOLUTION";

export class AssetApplicationError extends Error {
  readonly code: AssetApplicationErrorCode;

  constructor(code: AssetApplicationErrorCode, message: string) {
    super(message);
    this.name = "AssetApplicationError";
    this.code = code;
  }
}

export class AssetValidationError extends AssetApplicationError {
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super("ASSET_VALIDATION", message);
    this.name = "AssetValidationError";
    this.field = field;
  }
}

export class AssetNotFoundError extends AssetApplicationError {
  readonly assetId: string;

  constructor(assetId: string) {
    super("ASSET_NOT_FOUND", `Asset ${assetId} was not found.`);
    this.name = "AssetNotFoundError";
    this.assetId = assetId;
  }
}

export class AssetDuplicateError extends AssetApplicationError {
  readonly provider: string;
  readonly providerIdentifier: string;

  constructor(provider: string, providerIdentifier: string) {
    super(
      "ASSET_DUPLICATE",
      `The provider identifier ${providerIdentifier} is already registered for ${provider}.`,
    );
    this.name = "AssetDuplicateError";
    this.provider = provider;
    this.providerIdentifier = providerIdentifier;
  }
}

export class AssetInUseError extends AssetApplicationError {
  readonly assetId: string;

  constructor(assetId: string) {
    super("ASSET_IN_USE", `Asset ${assetId} has transactions.`);
    this.name = "AssetInUseError";
    this.assetId = assetId;
  }
}

export class AssetResolutionError extends AssetApplicationError {
  readonly field = "providerIdentifier";

  constructor(
    message: string,
    readonly reason: "not-found" | "unavailable",
  ) {
    super("ASSET_RESOLUTION", message);
    this.name = "AssetResolutionError";
  }
}
