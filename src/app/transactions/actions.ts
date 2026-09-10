"use server";

import { revalidatePath } from "next/cache";

import { getTransactionServices } from "@/server/transactions";
import {
  initialTransactionActionState,
  runCreateTransactionAction,
  unexpectedTransactionActionState,
} from "./action-handler";
import type { TransactionActionState } from "./action-handler";

export { initialTransactionActionState };
export type { TransactionActionState } from "./action-handler";

export async function createTransactionAction(
  previousState: TransactionActionState = initialTransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  try {
    const { createTransaction } = await getTransactionServices();
    return runCreateTransactionAction(
      previousState,
      formData,
      createTransaction,
      () => revalidatePath("/transactions"),
    );
  } catch (error) {
    return unexpectedTransactionActionState(error);
  }
}
