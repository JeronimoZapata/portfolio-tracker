"use server";

import { revalidatePath } from "next/cache";

import { getAssetServices } from "@/server/assets";
import {
  initialAssetActionState,
  runCreateAssetAction,
  runDeleteAssetAction,
  runUpdateAssetAction,
} from "./action-handler";
import type {
  AssetActionState,
  DeleteAssetActionState,
} from "./action-handler";

export { initialAssetActionState };
export type {
  AssetActionState,
  DeleteAssetActionState,
} from "./action-handler";

function revalidateAssetsAndTransactions() {
  revalidatePath("/assets");
  revalidatePath("/transactions");
}

export async function createAssetAction(
  previousState: AssetActionState = initialAssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  try {
    const { createAsset } = await getAssetServices();
    return runCreateAssetAction(
      previousState,
      formData,
      createAsset,
      revalidateAssetsAndTransactions,
    );
  } catch (error) {
    console.error("Unable to prepare create asset action.", error);
    return {
      status: "error",
      message: "No pudimos guardar el activo. Intentá nuevamente.",
    };
  }
}

export async function updateAssetAction(
  previousState: AssetActionState = initialAssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  try {
    const { updateAsset } = await getAssetServices();
    return runUpdateAssetAction(
      previousState,
      formData,
      updateAsset,
      revalidateAssetsAndTransactions,
    );
  } catch (error) {
    console.error("Unable to prepare update asset action.", error);
    return {
      status: "error",
      message: "No pudimos actualizar el activo. Intentá nuevamente.",
    };
  }
}

export async function deleteAssetAction(
  previousState: DeleteAssetActionState = { status: "idle" },
  formData: FormData,
): Promise<DeleteAssetActionState> {
  try {
    const { deleteAsset } = await getAssetServices();
    return runDeleteAssetAction(
      previousState,
      formData,
      deleteAsset,
      revalidateAssetsAndTransactions,
    );
  } catch (error) {
    console.error("Unable to prepare delete asset action.", error);
    return {
      status: "error",
      message: "No pudimos eliminar el activo. Intentá nuevamente.",
    };
  }
}
