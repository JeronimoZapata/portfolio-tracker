import {
  AssetDuplicateError,
  AssetInUseError,
  AssetNotFoundError,
  AssetResolutionError,
  AssetValidationError,
} from "@/application/assets";
import type { AssetType, AssetProvider, Asset } from "@/domain/portfolio";
import { providerForType } from "@/application/assets";
import type {
  CreateAssetCommand,
  UpdateAssetCommand,
} from "@/application/assets";

export type AssetActionStatus = "idle" | "success" | "error";

export type AssetFormField =
  "symbol" | "name" | "type" | "provider" | "providerIdentifier" | "exchange";

export type AssetActionState = {
  readonly status: AssetActionStatus;
  readonly message?: string;
  readonly fieldErrors?: Partial<Record<AssetFormField, string>>;
  readonly assetId?: string;
};

export type DeleteAssetActionState = {
  readonly status: AssetActionStatus;
  readonly message?: string;
  readonly assetId?: string;
};

export const initialAssetActionState: AssetActionState = { status: "idle" };

type AssetExecutor = {
  execute(input: CreateAssetCommand): Promise<Asset>;
};

type UpdateAssetExecutor = {
  execute(id: string, input: UpdateAssetCommand): Promise<Asset>;
};

type DeleteAssetExecutor = {
  execute(id: string): Promise<Asset>;
};

function value(formData: FormData, field: string): string {
  const raw = formData.get(field);
  return typeof raw === "string" ? raw.trim() : "";
}

function typeFromFormData(formData: FormData): AssetType {
  return value(formData, "type") as AssetType;
}

export function assetCommandFromFormData(
  formData: FormData,
): CreateAssetCommand {
  const type = typeFromFormData(formData);
  let provider: AssetProvider;
  try {
    provider = providerForType(type);
  } catch {
    provider = "ALPACA";
  }

  return {
    symbol: value(formData, "symbol"),
    name: value(formData, "name"),
    type,
    provider,
    providerIdentifier: value(formData, "providerIdentifier"),
    currency: "USD",
    exchange: value(formData, "exchange"),
  };
}

export function assetIdFromFormData(formData: FormData): string {
  return value(formData, "assetId");
}

export function updateAssetCommandFromFormData(
  formData: FormData,
): UpdateAssetCommand {
  const command = assetCommandFromFormData(formData);
  const identityMarker = formData.get("identityChanged");
  if (
    identityMarker === null ||
    value(formData, "identityChanged") === "true"
  ) {
    return command;
  }

  return Object.fromEntries(
    Object.entries(command).filter(
      ([key]) =>
        key !== "symbol" &&
        key !== "provider" &&
        key !== "providerIdentifier" &&
        key !== "type",
    ),
  ) as UpdateAssetCommand;
}

function validationMessage(field?: AssetFormField): string {
  switch (field) {
    case "symbol":
      return "Ingresá un símbolo válido.";
    case "name":
      return "Ingresá un nombre válido.";
    case "type":
      return "Seleccioná un tipo válido.";
    case "provider":
      return "El proveedor no coincide con el tipo de activo.";
    case "providerIdentifier":
      return "Seleccioná un activo válido del proveedor.";
    case "exchange":
      return "Ingresá el exchange para acciones y ETFs.";
    default:
      return "Revisá los datos ingresados.";
  }
}

function fieldForValidationError(
  field: string | undefined,
): AssetFormField | undefined {
  if (
    field === "symbol" ||
    field === "name" ||
    field === "type" ||
    field === "provider" ||
    field === "providerIdentifier" ||
    field === "exchange"
  ) {
    return field;
  }
  return undefined;
}

function assetErrorState(
  error: unknown,
  operation: "create" | "update",
): AssetActionState {
  if (error instanceof AssetValidationError) {
    const field = fieldForValidationError(error.field);
    return {
      status: "error",
      message: validationMessage(field),
      fieldErrors: field ? { [field]: validationMessage(field) } : undefined,
    };
  }
  if (error instanceof AssetDuplicateError) {
    return {
      status: "error",
      message: "Ya existe un activo con ese identificador para el proveedor.",
      fieldErrors: {
        providerIdentifier:
          "Este identificador ya está registrado para el proveedor.",
      },
    };
  }
  if (error instanceof AssetResolutionError) {
    const message =
      error.reason === "not-found"
        ? "El activo seleccionado no existe en el proveedor."
        : "No pudimos verificar el activo con el proveedor. Intentá nuevamente.";
    return {
      status: "error",
      message,
      fieldErrors: { providerIdentifier: message },
    };
  }
  if (error instanceof AssetNotFoundError) {
    return {
      status: "error",
      message:
        operation === "update"
          ? "El activo ya no existe. Actualizá la lista e intentá nuevamente."
          : "El activo no está disponible.",
    };
  }
  console.error(`Unable to ${operation} asset.`, error);
  return {
    status: "error",
    message:
      operation === "update"
        ? "No pudimos actualizar el activo. Intentá nuevamente."
        : "No pudimos guardar el activo. Intentá nuevamente.",
  };
}

export async function runCreateAssetAction(
  _previousState: AssetActionState,
  formData: FormData,
  executor: AssetExecutor,
  invalidate: () => void,
): Promise<AssetActionState> {
  try {
    const created = await executor.execute(assetCommandFromFormData(formData));
    try {
      invalidate();
    } catch (error) {
      console.error(
        "Unable to revalidate assets and transactions pages.",
        error,
      );
    }
    return {
      status: "success",
      message: "El activo se guardó correctamente.",
      assetId: created.id,
    };
  } catch (error) {
    return assetErrorState(error, "create");
  }
}

export async function runUpdateAssetAction(
  _previousState: AssetActionState,
  formData: FormData,
  executor: UpdateAssetExecutor,
  invalidate: () => void,
): Promise<AssetActionState> {
  try {
    const updated = await executor.execute(
      assetIdFromFormData(formData),
      updateAssetCommandFromFormData(formData),
    );
    try {
      invalidate();
    } catch (error) {
      console.error(
        "Unable to revalidate assets and transactions pages.",
        error,
      );
    }
    return {
      status: "success",
      message: "El activo se actualizó correctamente.",
      assetId: updated.id,
    };
  } catch (error) {
    return assetErrorState(error, "update");
  }
}

function deleteAssetErrorState(error: unknown): DeleteAssetActionState {
  if (error instanceof AssetInUseError) {
    return {
      status: "error",
      message: "No se puede eliminar un activo que tiene operaciones.",
    };
  }
  if (error instanceof AssetNotFoundError) {
    return {
      status: "error",
      message:
        "El activo ya no existe. Actualizá la lista e intentá nuevamente.",
    };
  }
  if (error instanceof AssetValidationError) {
    return {
      status: "error",
      message: "El activo seleccionado no es válido.",
    };
  }
  console.error("Unable to delete asset.", error);
  return {
    status: "error",
    message: "No pudimos eliminar el activo. Intentá nuevamente.",
  };
}

export async function runDeleteAssetAction(
  _previousState: DeleteAssetActionState,
  formData: FormData,
  executor: DeleteAssetExecutor,
  invalidate: () => void,
): Promise<DeleteAssetActionState> {
  try {
    const deleted = await executor.execute(assetIdFromFormData(formData));
    try {
      invalidate();
    } catch (error) {
      console.error(
        "Unable to revalidate assets and transactions pages.",
        error,
      );
    }
    return {
      status: "success",
      message: "El activo se eliminó correctamente.",
      assetId: deleted.id,
    };
  } catch (error) {
    return deleteAssetErrorState(error);
  }
}
