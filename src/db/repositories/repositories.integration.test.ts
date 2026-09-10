import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import type { Database } from "../index";
import { DrizzleAssetRepository } from "./asset-repository";
import { DrizzleTransactionRepository } from "./transaction-repository";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("Drizzle repositories", () => {
  let pool: Pool;
  let database: Database;
  let assets: DrizzleAssetRepository;
  let transactions: DrizzleTransactionRepository;
  let assetId: string;
  const transactionIds: string[] = [];
  let now = new Date("2025-01-01T00:00:00.000Z");

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    database = drizzle(pool, { schema });
    const clock = () => now;
    assets = new DrizzleAssetRepository(database, clock);
    transactions = new DrizzleTransactionRepository(database, clock);
    const asset = await assets.create({
      symbol: "REPOTEST",
      name: "Repository test asset",
      type: "STOCK",
      provider: "ALPACA",
      providerIdentifier: `repo-test-${randomUUID()}`,
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    for (const id of transactionIds) await transactions.delete(id);
    if (assetId) await assets.delete(assetId);
    await pool.end();
  });

  it("performs asset CRUD and updates updatedAt explicitly", async () => {
    const created = await assets.getById(assetId);
    expect(created?.name).toBe("Repository test asset");
    expect(created?.currency).toBe("USD");

    const createdAt = created?.createdAt;
    now = new Date("2025-01-02T00:00:00.000Z");
    const updated = await assets.update(assetId, { name: "Updated asset" });
    expect(updated?.name).toBe("Updated asset");
    expect(updated?.createdAt).toBe(createdAt);
    expect(updated?.updatedAt).toBe(now.toISOString());
    expect((await assets.list()).some((asset) => asset.id === assetId)).toBe(
      true,
    );

    const disposable = await assets.create({
      symbol: "DELETE",
      name: "Disposable asset",
      type: "STOCK",
      provider: "ALPACA",
      providerIdentifier: `repo-test-delete-${randomUUID()}`,
    });
    expect(await assets.delete(disposable.id)).toBe(true);
    expect(await assets.delete(disposable.id)).toBe(false);
  });

  it("performs transaction CRUD, preserves decimals, and orders ties by id", async () => {
    const date = "2025-01-03T00:00:00.000Z";
    const first = await transactions.create({
      assetId,
      type: "BUY",
      quantity: "0.000153820000000001",
      unitPrice: "12345.678901234567",
      transactionDate: date,
    });
    transactionIds.push(first.id);
    const second = await transactions.create({
      assetId,
      type: "BUY",
      quantity: "1.000000000000000001",
      unitPrice: "10.000000000001",
      transactionDate: date,
    });
    transactionIds.push(second.id);

    expect(first.quantity).toBe("0.000153820000000001");
    expect(first.unitPrice).toBe("12345.678901234567");
    expect((await transactions.getById(first.id))?.id).toBe(first.id);
    expect((await transactions.list({ assetId })).map((tx) => tx.id)).toEqual(
      [first.id, second.id].sort(),
    );

    now = new Date("2025-01-04T00:00:00.000Z");
    const updated = await transactions.update(first.id, {
      notes: "edited",
      quantity: "0.000153820000000002",
    });
    expect(updated?.notes).toBe("edited");
    expect(updated?.quantity).toBe("0.000153820000000002");
    expect(updated?.updatedAt).toBe(now.toISOString());
    expect(await transactions.delete(second.id)).toBe(true);
    expect(await transactions.getById(second.id)).toBeNull();
    expect(await transactions.delete(second.id)).toBe(false);
  });

  it("does not allow deleting an asset with transactions", async () => {
    const transaction = await transactions.create({
      assetId,
      type: "BUY",
      quantity: "1",
      unitPrice: "1",
      transactionDate: "2025-01-05T00:00:00.000Z",
    });
    transactionIds.push(transaction.id);
    await expect(assets.delete(assetId)).rejects.toThrow();
  });
});
