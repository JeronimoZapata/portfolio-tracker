import { randomUUID } from "node:crypto";

import type { Transaction } from "../../domain/portfolio/types";
import { AssetNotFoundError } from "./errors";
import { toPortfolioTransaction, validateLedger } from "./ledger";
import type {
  CreateTransactionCommand,
  IdGenerator,
  TransactionUnitOfWork,
} from "./ports";
import {
  normalizeCreateTransaction,
  normalizeTransactionId,
} from "./validation";

export class CreateTransaction {
  constructor(
    private readonly unitOfWork: TransactionUnitOfWork,
    private readonly idGenerator: IdGenerator = randomUUID,
  ) {}

  async execute(input: CreateTransactionCommand): Promise<Transaction> {
    const normalized = normalizeCreateTransaction(input);
    const id = normalizeTransactionId(this.idGenerator());
    const candidate = {
      id,
      ...normalized,
    };

    return this.unitOfWork.execute(async (context) => {
      const assets = await context.lockAssets([normalized.assetId]);
      if (assets.length !== 1 || assets[0]?.id !== normalized.assetId) {
        throw new AssetNotFoundError(normalized.assetId);
      }

      const ledger = await context.transactions.list({
        assetId: normalized.assetId,
      });
      validateLedger([
        ...ledger.map(toPortfolioTransaction),
        toPortfolioTransaction(candidate),
      ]);

      return context.transactions.create(candidate);
    });
  }
}
