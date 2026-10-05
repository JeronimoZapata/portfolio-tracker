import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../index";
import { assets } from "../schema";
import { toDomainAsset } from "../mappers";
import type { Asset } from "../../domain/portfolio/types";
import { validateAssetInput, validateId } from "./validation";
import type {
  AssetRepository,
  CreateAssetInput,
  UpdateAssetInput,
} from "./types";
import {
  AssetDuplicateError,
  AssetInUseError,
  isAssetIdentifierUniqueViolation,
  isAssetReferenceViolation,
} from "./errors";

export type Clock = () => Date;

export class DrizzleAssetRepository implements AssetRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create(input: CreateAssetInput): Promise<Asset> {
    const values = validateAssetInput({ ...input }, false) as CreateAssetInput;
    let row: typeof assets.$inferSelect | undefined;
    try {
      [row] = await this.database
        .insert(assets)
        .values({ ...values, updatedAt: this.clock() })
        .returning();
    } catch (error) {
      if (isAssetIdentifierUniqueViolation(error)) {
        throw new AssetDuplicateError(
          values.provider,
          values.providerIdentifier,
        );
      }
      throw error;
    }
    if (!row) throw new Error("Asset insert did not return a row.");
    return toDomainAsset(row);
  }

  async getById(id: string): Promise<Asset | null> {
    const [row] = await this.database
      .select()
      .from(assets)
      .where(eq(assets.id, validateId("id", id)))
      .limit(1);
    return row ? toDomainAsset(row) : null;
  }

  async findByProviderIdentifier(
    provider: CreateAssetInput["provider"],
    providerIdentifier: string,
  ): Promise<Asset | null> {
    const [row] = await this.database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.provider, provider),
          eq(assets.providerIdentifier, providerIdentifier.trim()),
        ),
      )
      .limit(1);
    return row ? toDomainAsset(row) : null;
  }

  async lockById(id: string): Promise<Asset | null> {
    const [row] = await this.database
      .select()
      .from(assets)
      .where(eq(assets.id, validateId("id", id)))
      .for("update")
      .limit(1);
    return row ? toDomainAsset(row) : null;
  }

  async lockMany(ids: readonly string[]): Promise<Asset[]> {
    const validatedIds = [...new Set(ids)].map((id) => validateId("id", id));
    if (validatedIds.length === 0) return [];
    const rows = await this.database
      .select()
      .from(assets)
      .where(inArray(assets.id, validatedIds))
      .orderBy(asc(assets.id))
      .for("update");
    return rows.map(toDomainAsset);
  }

  async list(): Promise<Asset[]> {
    const rows = await this.database
      .select()
      .from(assets)
      .orderBy(asc(assets.symbol), asc(assets.id));
    return rows.map(toDomainAsset);
  }

  async update(id: string, input: UpdateAssetInput): Promise<Asset | null> {
    const assetId = validateId("id", id);
    validateAssetInput({ ...input }, true);
    const [existing] = await this.database
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);
    if (!existing) return null;

    const values = validateAssetInput(
      {
        symbol: input.symbol ?? existing.symbol,
        name: input.name ?? existing.name,
        type: input.type ?? existing.type,
        provider: input.provider ?? existing.provider,
        providerIdentifier:
          input.providerIdentifier ?? existing.providerIdentifier,
        currency: input.currency ?? existing.currency,
        exchange:
          input.exchange === undefined ? existing.exchange : input.exchange,
      },
      false,
    ) as CreateAssetInput;
    const changedValues: UpdateAssetInput = {};
    if (input.symbol !== undefined) changedValues.symbol = values.symbol;
    if (input.name !== undefined) changedValues.name = values.name;
    if (input.type !== undefined) changedValues.type = values.type;
    if (input.provider !== undefined) changedValues.provider = values.provider;
    if (input.providerIdentifier !== undefined) {
      changedValues.providerIdentifier = values.providerIdentifier;
    }
    if (input.currency !== undefined) changedValues.currency = values.currency;
    if (input.exchange !== undefined) changedValues.exchange = values.exchange;
    let row: typeof assets.$inferSelect | undefined;
    try {
      [row] = await this.database
        .update(assets)
        .set({ ...changedValues, updatedAt: this.clock() })
        .where(eq(assets.id, assetId))
        .returning();
    } catch (error) {
      if (isAssetIdentifierUniqueViolation(error)) {
        throw new AssetDuplicateError(
          values.provider ?? existing.provider,
          values.providerIdentifier ?? existing.providerIdentifier,
        );
      }
      throw error;
    }
    return row ? toDomainAsset(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      const rows = await this.database
        .delete(assets)
        .where(eq(assets.id, validateId("id", id)))
        .returning({ id: assets.id });
      return rows.length === 1;
    } catch (error) {
      if (isAssetReferenceViolation(error)) {
        throw new AssetInUseError(id);
      }
      throw error;
    }
  }
}
