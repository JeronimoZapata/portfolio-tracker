import { OversellError } from "@/domain/portfolio";
import {
  AssetNotFoundError,
  TransactionValidationError,
} from "@/application/transactions";
import type { CreateTransactionCommand } from "@/application/transactions";
import type { Transaction } from "@/domain/portfolio";

export type TransactionActionStatus = "idle" | "success" | "error";

export type TransactionActionState = {
  readonly status: TransactionActionStatus;
  readonly message?: string;
  readonly fieldErrors?: Partial<Record<TransactionFormField, string>>;
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
): TransactionActionState {
  console.error("Unable to create transaction.", error);
  return {
    status: "error",
    message: "No pudimos guardar la operación. Intentá nuevamente.",
  };
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
        fieldErrors: {
          assetId: "El activo seleccionado ya no está disponible.",
        },
      };
    }

    if (error instanceof OversellError) {
      return {
        status: "error",
        message: "La venta supera la posición disponible para este activo.",
      };
    }

    return unexpectedTransactionActionState(error);
  }
}
