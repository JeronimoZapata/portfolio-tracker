import { NextResponse } from "next/server";

import { getAssetCatalog } from "@/server/asset-catalog";
import type { AssetType } from "@/domain/portfolio";
import { ProviderCatalogError } from "@/integrations/asset-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assetTypes = new Set<AssetType>(["STOCK", "ETF", "CRYPTO"]);

function isAssetType(value: string | null): value is AssetType {
  return value !== null && assetTypes.has(value as AssetType);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const query = url.searchParams.get("query")?.trim() ?? "";

  if (!isAssetType(type)) {
    return NextResponse.json(
      { message: "El tipo de activo no es válido." },
      { status: 400 },
    );
  }
  if (!query) {
    return NextResponse.json({ candidates: [] });
  }

  try {
    const candidates = await getAssetCatalog().search(type, query);
    return NextResponse.json({ candidates });
  } catch (error) {
    if (error instanceof ProviderCatalogError) {
      const status =
        error.code === "PROVIDER_RATE_LIMITED"
          ? 429
          : error.code === "PROVIDER_UNAUTHORIZED" ||
              error.code === "PROVIDER_CONFIG"
            ? 503
            : 502;
      return NextResponse.json(
        {
          message:
            status === 429
              ? "El proveedor alcanzó su límite de solicitudes. Esperá unos segundos e intentá nuevamente."
              : "El proveedor no está disponible en este momento.",
        },
        { status },
      );
    }
    console.error("Unable to search provider assets.", error);
    return NextResponse.json(
      { message: "No pudimos buscar el activo en el proveedor." },
      { status: 502 },
    );
  }
}
