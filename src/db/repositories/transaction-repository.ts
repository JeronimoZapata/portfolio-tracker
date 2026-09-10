import { asc, eq } from "drizzle-orm";

import type { Database } from "../index";
import { transactions } from "../schema";
import { toDomainTransaction } from "../mappers";
import type { Transaction } from "../../domain/portfolio/types";
import { validateId, validateTransactionInput } from "./validation";
import type {
  CreateTransactionInput,
  TransactionListOptions,
  TransactionRepository,
  UpdateTransactionInput,
} from "./types";
import type { Clock } from "./asset-repository";

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const values = validateTransactionInput(
      { ...input },
      false,
    ) as CreateTransactionInput;
    const [row] = await this.database
      .insert(transactions)
      .values({
        ...values,
        transactionDate: new Date(values.transactionDate),
        updatedAt: this.clock(),
      })
      .returning();
    if (!row) throw new Error("Transaction insert did not return a row.");
    return toDomainTransaction(row);
  }

  async getById(id: string): Promise<Transaction | null> {
    const [row] = await this.database
      .select()
      .from(transactions)
      .where(eq(transactions.id, validateId("id", id)))
      .limit(1);
    return row ? toDomainTransaction(row) : null;
  }

  async lockById(id: string): Promise<Transaction | null> {
    const [row] = await this.database
      .select()
      .from(transactions)
      .where(eq(transactions.id, validateId("id", id)))
      .for("update")
      .limit(1);
    return row ? toDomainTransaction(row) : null;
  }

  async list(options: TransactionListOptions = {}): Promise<Transaction[]> {
    const assetId = options.assetId
      ? validateId("assetId", options.assetId)
      : undefined;
    const rows = await this.database
      .select()
      .from(transactions)
      .where(assetId ? eq(transactions.assetId, assetId) : undefined)
      .orderBy(asc(transactions.transactionDate), asc(transactions.id));
    return rows.map(toDomainTransaction);
  }

  async update(
    id: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction | null> {
    const values = validateTransactionInput(
      { ...input },
      true,
    ) as UpdateTransactionInput;
    const updateValues: Partial<{
      assetId: string;
      type: "BUY" | "SELL";
      quantity: string;
      unitPrice: string;
      transactionDate: Date;
      currency: string;
      fees: string;
      notes: string | null;
    }> = {};
    if (values.assetId !== undefined) updateValues.assetId = values.assetId;
    if (values.type !== undefined) updateValues.type = values.type;
    if (values.quantity !== undefined) updateValues.quantity = values.quantity;
    if (values.unitPrice !== undefined) {
      updateValues.unitPrice = values.unitPrice;
    }
    if (values.transactionDate !== undefined) {
      updateValues.transactionDate = new Date(values.transactionDate);
    }
    if (values.currency !== undefined) updateValues.currency = values.currency;
    if (values.fees !== undefined) updateValues.fees = values.fees;
    if (values.notes !== undefined) updateValues.notes = values.notes;
    const [row] = await this.database
      .update(transactions)
      .set({ ...updateValues, updatedAt: this.clock() })
      .where(eq(transactions.id, validateId("id", id)))
      .returning();
    return row ? toDomainTransaction(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.database
      .delete(transactions)
      .where(eq(transactions.id, validateId("id", id)))
      .returning({ id: transactions.id });
    return rows.length === 1;
  }
}
