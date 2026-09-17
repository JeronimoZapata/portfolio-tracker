"use server";

import { revalidatePath } from "next/cache";

import { getTransactionServices } from "@/server/transactions";
import {
  initialTransactionActionState,
  runCreateTransactionAction,
  runDeleteTransactionAction,
  runUpdateTransactionAction,
  unexpectedTransactionActionState,
} from "./action-handler";
import type {
  DeleteTransactionActionState,
  TransactionActionState,
} from "./action-handler";

export { initialTransactionActionState };
export type { TransactionActionState } from "./action-handler";
export type { DeleteTransactionActionState } from "./action-handler";

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

export async function updateTransactionAction(
  previousState: TransactionActionState = initialTransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  try {
    const { updateTransaction } = await getTransactionServices();
    return runUpdateTransactionAction(
      previousState,
      formData,
      updateTransaction,
      () => revalidatePath("/transactions"),
    );
  } catch (error) {
    return unexpectedTransactionActionState(error, "update");
  }
}

export async function deleteTransactionAction(
  previousState: DeleteTransactionActionState = { status: "idle" },
  formData: FormData,
): Promise<DeleteTransactionActionState> {
  try {
    const { deleteTransaction } = await getTransactionServices();
    return runDeleteTransactionAction(
      previousState,
      formData,
      deleteTransaction,
      () => revalidatePath("/transactions"),
    );
  } catch (error) {
    console.error("Unable to prepare delete transaction action.", error);
    return {
      status: "error",
      message: "No pudimos eliminar la operación. Intentá nuevamente.",
    };
  }
}
