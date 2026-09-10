import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  loadTransactionsPage,
  type TransactionsPageData,
} from "@/server/transactions";
import { TransactionForm } from "./transaction-form";
import { TransactionTable } from "./transaction-table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Transacciones | Portfolio Tracker",
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

export default async function TransactionsPage() {
  let data: TransactionsPageData;
  try {
    data = await loadTransactionsPage();
  } catch (error) {
    console.error("Unable to load transactions page.", error);
    return <DatabaseUnavailable />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            Portfolio Tracker
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Transacciones
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Registrá compras y ventas manuales para mantener tu historial de
            inversiones.
          </p>
        </header>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Nueva operación</h2>
            <p className="mt-1 text-sm text-slate-500">
              La comisión y la moneda están fijadas por las reglas actuales del
              MVP.
            </p>
          </CardHeader>
          <CardContent>
            <TransactionForm assets={data.assets} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Historial de operaciones
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Las más recientes aparecen primero.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {data.transactions.length}{" "}
                {data.transactions.length === 1 ? "operación" : "operaciones"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <TransactionTable rows={data.transactions} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
