import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { loadAssetsPage } from "@/server/assets";
import { AssetForm } from "./asset-form";
import { AssetTable } from "./asset-table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Activos | Portfolio Tracker",
};

function DatabaseUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
          Estado no disponible
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          No pudimos conectar con la base de datos
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Revisá la conexión e intentá recargar la página. No mostramos detalles
          internos de la base para proteger la aplicación.
        </p>
      </section>
    </main>
  );
}

export default async function AssetsPage() {
  let assets;
  try {
    assets = await loadAssetsPage();
  } catch (error) {
    console.error("Unable to load assets page.", error);
    return <DatabaseUnavailable />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            Portfolio Tracker
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Activos
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Administrá los instrumentos que vas a usar en tus operaciones.
              </p>
            </div>
            <a
              href="/transactions"
              className="text-sm font-semibold text-sky-700 hover:text-sky-900"
            >
              Ir a transacciones →
            </a>
          </div>
        </header>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Nuevo activo</h2>
            <p className="mt-1 text-sm text-slate-500">
              El proveedor y la moneda se determinan según las reglas del MVP.
            </p>
          </CardHeader>
          <CardContent>
            <AssetForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Activos registrados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Los activos con operaciones no se pueden eliminar.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {assets.length} {assets.length === 1 ? "activo" : "activos"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <AssetTable assets={assets} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
