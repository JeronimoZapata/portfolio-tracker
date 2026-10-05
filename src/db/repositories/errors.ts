import { AssetDuplicateError, AssetInUseError } from "../../application/assets";

export { AssetDuplicateError, AssetInUseError };

type PostgresLikeError = {
  code?: string;
  constraint?: string;
  detail?: string;
  cause?: unknown;
};

function postgresError(error: unknown): PostgresLikeError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    const candidate = current as PostgresLikeError;
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  return null;
}

export function isPostgresError(error: unknown): error is PostgresLikeError {
  return postgresError(error) !== null;
}

export function isAssetIdentifierUniqueViolation(error: unknown): boolean {
  const cause = postgresError(error);
  if (!cause || cause.code !== "23505") return false;
  const text = `${cause.constraint ?? ""} ${cause.detail ?? ""}`.toLowerCase();
  return text.includes("provider") && text.includes("identifier");
}

export function isAssetReferenceViolation(error: unknown): boolean {
  return postgresError(error)?.code === "23503";
}
