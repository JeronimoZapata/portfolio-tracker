import { describe, expect, it } from "vitest";

import type { Asset, Transaction } from "../../domain/portfolio/types";
import { calculatePosition, OversellError } from "../../domain/portfolio";
import {
  AssetNotFoundError,
  CreateTransaction,
  DeleteTransaction,
  ListTransactions,
  TransactionNotFoundError,
  TransactionValidationError,
  TransactionMutationContext,
  TransactionRepository,
  TransactionUnitOfWork,
  UpdateTransaction,
} from ".";
import type {
  CreateTransactionRecord,
  TransactionListOptions,
  UpdateTransactionRecord,
} from "./ports";

const ASSET_A = "00000000-0000-4000-8000-000000000001";
const ASSET_B = "00000000-0000-4000-8000-000000000002";
const BUY_A = "00000000-0000-4000-8000-000000000101";
const BUY_B = "00000000-0000-4000-8000-000000000102";
const SELL_A = "00000000-0000-4000-8000-000000000103";
const SELL_B = "00000000-0000-4000-8000-000000000104";
const DATE = "2025-01-01T00:00:00.000Z";

function asset(id: string): Asset {
  return {
    id,
    symbol: id === ASSET_A ? "AAA" : "BBB",
    name: "Test asset",
    type: "STOCK",
    provider: "ALPACA",
    providerIdentifier: id,
    currency: "USD",
    exchange: "NYSE",
    createdAt: DATE,
    updatedAt: DATE,
  };
}

function transaction(
  id: string,
  input: Partial<CreateTransactionRecord> = {},
): Transaction {
  return {
    id,
    assetId: ASSET_A,
    type: "BUY",
    quantity: "1",
    unitPrice: "10",
    currency: "USD",
    fees: "0",
    transactionDate: DATE,
    notes: null,
    createdAt: DATE,
    updatedAt: DATE,
    ...input,
  };
}

class MemoryRepositories implements TransactionUnitOfWork {
  readonly assets = new Map<string, Asset>([
    [ASSET_A, asset(ASSET_A)],
    [ASSET_B, asset(ASSET_B)],
  ]);
  readonly transactions = new Map<string, Transaction>();
  failAfterWrite = false;
  private running = false;

  private readonly transactionRepository: TransactionRepository = {
    create: async (input) => {
      const created = transaction(input.id, input);
      this.transactions.set(created.id, created);
      if (this.failAfterWrite) throw new Error("persistence failure");
      return created;
    },
    getById: async (id) => this.transactions.get(id) ?? null,
    list: async (options: TransactionListOptions = {}) =>
      [...this.transactions.values()].filter(
        (item) => !options.assetId || item.assetId === options.assetId,
      ),
    update: async (id, input: UpdateTransactionRecord) => {
      const existing = this.transactions.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...input, updatedAt: DATE };
      this.transactions.set(id, updated);
      if (this.failAfterWrite) throw new Error("persistence failure");
      return updated;
    },
    delete: async (id) => this.transactions.delete(id),
  };

  async execute<T>(
    work: (context: TransactionMutationContext) => Promise<T>,
  ): Promise<T> {
    if (this.running)
      throw new Error("Nested memory transactions are unsupported.");
    this.running = true;
    const snapshot = new Map(this.transactions);
    try {
      return await work({
        assets: { getById: async (id) => this.assets.get(id) ?? null },
        transactions: this.transactionRepository,
        lockAssets: async (ids) =>
          [...new Set(ids)]
            .map((id) => this.assets.get(id))
            .filter((item): item is Asset => item !== undefined),
        lockTransaction: async (id) => this.transactions.get(id) ?? null,
      });
    } catch (error) {
      this.transactions.clear();
      for (const [id, item] of snapshot) this.transactions.set(id, item);
      throw error;
    } finally {
      this.running = false;
    }
  }
}

function createService(
  repositories: MemoryRepositories,
  id = "00000000-0000-4000-8000-000000000999",
) {
  return new CreateTransaction(repositories, () => id);
}

describe("transaction application services", () => {
  it("creates a transaction after validating the asset and ledger", async () => {
    const repositories = new MemoryRepositories();
    const created = await createService(repositories).execute({
      assetId: ASSET_A,
      type: "BUY",
      quantity: "0.000153820000000001",
      unitPrice: "12345.678901234567",
      transactionDate: DATE,
    });

    expect(created.id).toBe("00000000-0000-4000-8000-000000000999");
    expect(created.fees).toBe("0");
    expect(
      calculatePosition([
        {
          id: created.id,
          type: created.type,
          quantity: created.quantity,
          unitPrice: created.unitPrice,
          fees: created.fees,
          transactionDate: created.transactionDate,
        },
      ]).quantity,
    ).toBe("0.000153820000000001");
  });

  it("rejects an unknown asset, non-zero fees, and overselling without writing", async () => {
    const repositories = new MemoryRepositories();
    const create = createService(repositories);

    await expect(
      create.execute({
        assetId: "00000000-0000-4000-8000-000000000003",
        type: "BUY",
        quantity: "1",
        unitPrice: "1",
        transactionDate: DATE,
      }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    await expect(
      create.execute({
        assetId: ASSET_A,
        type: "BUY",
        quantity: "1",
        unitPrice: "1",
        transactionDate: DATE,
        fees: "0.01",
      }),
    ).rejects.toBeInstanceOf(TransactionValidationError);

    await repositories.transactions.set(
      BUY_A,
      transaction(BUY_A, { quantity: "1" }),
    );
    await expect(
      create.execute({
        assetId: ASSET_A,
        type: "SELL",
        quantity: "2",
        unitPrice: "12",
        transactionDate: "2025-01-02T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(OversellError);
    expect(
      repositories.transactions.has("00000000-0000-4000-8000-000000000999"),
    ).toBe(false);
  });

  it("updates a historical buy only when all later sells remain valid", async () => {
    const repositories = new MemoryRepositories();
    repositories.transactions.set(BUY_A, transaction(BUY_A, { quantity: "2" }));
    repositories.transactions.set(
      SELL_A,
      transaction(SELL_A, {
        type: "SELL",
        quantity: "2",
        unitPrice: "15",
        transactionDate: "2025-01-02T00:00:00.000Z",
      }),
    );
    const update = new UpdateTransaction(repositories);

    await expect(
      update.execute(BUY_A, { quantity: "1" }),
    ).rejects.toBeInstanceOf(OversellError);
    expect(repositories.transactions.get(BUY_A)?.quantity).toBe("2");

    const updated = await update.execute(BUY_A, { quantity: "3" });
    expect(updated.quantity).toBe("3");
  });

  it("updates a sale and validates both ledgers when moving an operation", async () => {
    const repositories = new MemoryRepositories();
    repositories.transactions.set(BUY_A, transaction(BUY_A, { quantity: "2" }));
    repositories.transactions.set(
      SELL_A,
      transaction(SELL_A, {
        type: "SELL",
        quantity: "1",
        transactionDate: "2025-01-02T00:00:00.000Z",
      }),
    );
    repositories.transactions.set(
      BUY_B,
      transaction(BUY_B, { assetId: ASSET_B }),
    );
    const update = new UpdateTransaction(repositories);

    await expect(
      update.execute(SELL_A, { assetId: ASSET_B, quantity: "2" }),
    ).rejects.toBeInstanceOf(OversellError);
    expect(repositories.transactions.get(SELL_A)?.assetId).toBe(ASSET_A);

    const moved = await update.execute(SELL_A, { assetId: ASSET_B });
    expect(moved.assetId).toBe(ASSET_B);
    expect(repositories.transactions.get(SELL_A)?.assetId).toBe(ASSET_B);
  });

  it("rejects empty and unknown updates", async () => {
    const repositories = new MemoryRepositories();
    const update = new UpdateTransaction(repositories);
    await expect(update.execute(BUY_A, {})).rejects.toBeInstanceOf(
      TransactionValidationError,
    );
    await expect(
      update.execute(BUY_A, { quantity: "1" }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it("deletes a transaction only when the resulting ledger is valid", async () => {
    const repositories = new MemoryRepositories();
    repositories.transactions.set(BUY_A, transaction(BUY_A, { quantity: "2" }));
    repositories.transactions.set(
      SELL_A,
      transaction(SELL_A, {
        type: "SELL",
        quantity: "1",
        transactionDate: "2025-01-02T00:00:00.000Z",
      }),
    );
    const remove = new DeleteTransaction(repositories);

    await expect(remove.execute(BUY_A)).rejects.toBeInstanceOf(OversellError);
    expect(repositories.transactions.has(BUY_A)).toBe(true);
    const deleted = await remove.execute(SELL_A);
    expect(deleted.id).toBe(SELL_A);
    expect(repositories.transactions.has(SELL_A)).toBe(false);
    await expect(remove.execute(SELL_A)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });

  it("rolls back a repository failure without leaving a partial mutation", async () => {
    const repositories = new MemoryRepositories();
    repositories.transactions.set(BUY_A, transaction(BUY_A));
    repositories.failAfterWrite = true;

    await expect(
      new UpdateTransaction(repositories).execute(BUY_A, { quantity: "2" }),
    ).rejects.toThrow("persistence failure");
    expect(repositories.transactions.get(BUY_A)?.quantity).toBe("1");
  });

  it("lists all transactions and validates a filtered asset", async () => {
    const repositories = new MemoryRepositories();
    repositories.transactions.set(
      SELL_B,
      transaction(SELL_B, {
        assetId: ASSET_B,
        transactionDate: "2025-01-03T00:00:00.000Z",
      }),
    );
    repositories.transactions.set(
      BUY_A,
      transaction(BUY_A, {
        transactionDate: "2025-01-02T00:00:00.000Z",
      }),
    );
    const list = new ListTransactions(
      { getById: async (id) => repositories.assets.get(id) ?? null },
      repositories["transactionRepository"],
    );

    expect((await list.execute()).map((item) => item.id)).toEqual([
      BUY_A,
      SELL_B,
    ]);
    expect(
      (await list.execute({ assetId: ASSET_A })).map((item) => item.id),
    ).toEqual([BUY_A]);
    await expect(
      list.execute({ assetId: "00000000-0000-4000-8000-000000000003" }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
  });
});
