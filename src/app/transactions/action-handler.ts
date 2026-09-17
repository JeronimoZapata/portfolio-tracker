import { OversellError } from "@/domain/portfolio";
import {
  AssetNotFoundError,
  TransactionNotFoundError,
  TransactionValidationError,
} from "@/application/transactions";
import type {
  CreateTransactionCommand,
  UpdateTransactionCommand,
} from "@/application/transactions";
import type { Transaction } from "@/domain/portfolio";

export type TransactionActionStatus = "idle" | "success" | "error";

export type TransactionActionState = {
  readonly status: TransactionActionStatus;
  readonly message?: string;
  readonly fieldErrors?: Partial<Record<TransactionFormField, string>>;
  readonly transactionId?: string;
};

export type DeleteTransactionActionState = {
  readonly status: TransactionActionStatus;
  readonly message?: string;
  readonly transactionId?: string;
};

export type TransactionFormField =
  "assetId" | "type" | "quantity" | "unitPrice" | "transactionDate" | "notes";

export const initialTransactionActionState: TransactionActionState = {
  status: "idle",
};

type TransactionExecutor = {
  execute(input: CreateTransactionCommand): Promise<Transaction>;
};

type UpdateTransactionExecutor = {
  execute(id: string, input: UpdateTransactionCommand): Promise<Transaction>;
};

type DeleteTransactionExecutor = {
  execute(id: string): Promise<Transaction>;
};

export function transactionCommandFromFormData(
  formData: FormData,
): CreateTransactionCommand {
  const value = (field: string) => {
    const raw = formData.get(field);
    return typeof raw === "string" ? raw.trim() : "";
  };

  return {
    assetId: value("assetId"),
    type: value("type") as CreateTransactionCommand["type"],
    quantity: value("quantity"),
    unitPrice: value("unitPrice"),
    transactionDate: value("transactionDate"),
    currency: "USD",
    fees: "0",
    notes: value("notes") || null,
  };
}

export function transactionIdFromFormData(formData: FormData): string {
  const raw = formData.get("transactionId");
  return typeof raw === "string" ? raw.trim() : "";
}

export function updateTransactionCommandFromFormData(
  formData: FormData,
): UpdateTransactionCommand {
  return transactionCommandFromFormData(formData);
}

function fieldForValidationError(
  field: string | undefined,
): TransactionFormField | undefined {
  if (
    field === "assetId" ||
    field === "type" ||
    field === "quantity" ||
    field === "unitPrice" ||
    field === "transactionDate" ||
    field === "notes"
  ) {
    return field;
  }
  return undefined;
}

function validationMessage(field: TransactionFormField | undefined): string {
  switch (field) {
    case "assetId":
      return "Seleccioná un activo válido.";
    case "type":
      return "Elegí si la operación es una compra o una venta.";
    case "quantity":
      return "Ingresá una cantidad mayor que cero, con formato decimal válido.";
    case "unitPrice":
      return "Ingresá un precio unitario válido, igual o mayor que cero.";
    case "transactionDate":
      return "Ingresá una fecha y hora válidas.";
    case "notes":
      return "Revisá las notas ingresadas.";
    default:
      return "Revisá los datos de la operación.";
  }
}

export function unexpectedTransactionActionState(
  error: unknown,
  operation: "create" | "update" = "create",
): TransactionActionState {
  console.error(`Unable to ${operation} transaction.`, error);
  return {
    status: "error",
    message: "No pudimos guardar la operación. Intentá nuevamente.",
  };
}

function transactionErrorState(
  error: unknown,
  operation: "create" | "update",
): TransactionActionState {
  if (error instanceof TransactionValidationError) {
    const field = fieldForValidationError(error.field);
    return {
      status: "error",
      message: validationMessage(field),
      fieldErrors: field ? { [field]: validationMessage(field) } : undefined,
    };
  }
  if (error instanceof AssetNotFoundError) {
    return {
      status: "error",
      message: "El activo seleccionado ya no está disponible.",
      fieldErrors: { assetId: "El activo seleccionado ya no está disponible." },
    };
  }
  if (error instanceof TransactionNotFoundError) {
    return {
      status: "error",
      message:
        "La operación ya no existe. Actualizá la lista e intentá nuevamente.",
    };
  }
  if (error instanceof OversellError) {
    return {
      status: "error",
      message:
        operation === "create"
          ? "La venta supera la posición disponible para este activo."
          : "Los cambios invalidan una venta posterior porque dejarían una cantidad insuficiente.",
    };
  }
  return unexpectedTransactionActionState(error, operation);
}

export async function runCreateTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
  executor: TransactionExecutor,
  invalidate: () => void,
): Promise<TransactionActionState> {
  try {
    const created = await executor.execute(
      transactionCommandFromFormData(formData),
    );

    try {
      invalidate();
    } catch (error) {
      // The write already succeeded. Keep the success response truthful while
      // leaving the invalidation failure visible in server logs.
      console.error("Unable to revalidate transactions page.", error);
    }

    return {
      status: "success",
      message: "La operación se guardó correctamente.",
      transactionId: created.id,
    };
  } catch (error) {
    return transactionErrorState(error, "create");
  }
}

export async function runUpdateTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
  executor: UpdateTransactionExecutor,
  invalidate: () => void,
): Promise<TransactionActionState> {
  try {
    const transactionId = transactionIdFromFormData(formData);
    const updated = await executor.execute(
      transactionId,
      updateTransactionCommandFromFormData(formData),
    );
    try {
      invalidate();
    } catch (error) {
      console.error("Unable to revalidate transactions page.", error);
    }
    return {
      status: "success",
      message: "La operación se actualizó correctamente.",
      transactionId: updated.id,
    };
  } catch (error) {
    return transactionErrorState(error, "update");
  }
}

function deleteTransactionErrorState(
  error: unknown,
): DeleteTransactionActionState {
  if (error instanceof TransactionNotFoundError) {
    return {
      status: "error",
      message:
        "La operación ya no existe. Actualizá la lista e intentá nuevamente.",
    };
  }
  if (error instanceof OversellError) {
    return {
      status: "error",
      message:
        "La operación no se puede eliminar porque dejaría una venta posterior sin cantidad suficiente.",
    };
  }
  if (error instanceof TransactionValidationError) {
    return {
      status: "error",
      message: "La operación seleccionada no es válida.",
    };
  }
  console.error("Unable to delete transaction.", error);
  return {
    status: "error",
    message: "No pudimos eliminar la operación. Intentá nuevamente.",
  };
}

export async function runDeleteTransactionAction(
  _previousState: DeleteTransactionActionState,
  formData: FormData,
  executor: DeleteTransactionExecutor,
  invalidate: () => void,
): Promise<DeleteTransactionActionState> {
  try {
    const transactionId = transactionIdFromFormData(formData);
    const deleted = await executor.execute(transactionId);
    try {
      invalidate();
    } catch (error) {
      console.error("Unable to revalidate transactions page.", error);
    }
    return {
      status: "success",
      message: "La operación se eliminó correctamente.",
      transactionId: deleted.id,
    };
  } catch (error) {
    return deleteTransactionErrorState(error);
  }
}
