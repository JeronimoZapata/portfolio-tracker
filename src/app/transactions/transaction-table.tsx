"use client";

import { Fragment, useActionState, useEffect, useState } from "react";

import type { Asset } from "@/domain/portfolio";
import type { TransactionListItem } from "@/server/transactions";
import { deleteTransactionAction } from "./actions";
import { EditTransactionForm } from "./transaction-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalDateTime } from "./local-date-time";

type TransactionTableProps = {
  readonly rows: TransactionListItem[];
  readonly assets: Asset[];
};

export function formatDecimal(value: string): string {
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = sign ? value.slice(1) : value;
  const [integerPart, fractionPart] = unsigned.split(".");
  const groupedInteger = (integerPart || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  const fraction = fractionPart?.replace(/0+$/, "") ?? "";
  return `${sign}${groupedInteger}${fraction ? `,${fraction}` : ""}`;
}

function DeleteControls({
  transactionId,
  active,
  disabled,
  onActivate,
  onCancel,
  onDeleted,
}: {
  readonly transactionId: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly onDeleted: () => void;
}) {
  const [state, formAction, pending] = useActionState(deleteTransactionAction, {
    status: "idle" as const,
  });
  useEffect(() => {
    if (state.status === "success") onDeleted();
  }, [onDeleted, state.status]);

  if (!active)
    return (
      <Button
        type="button"
        onClick={onActivate}
        disabled={pending || disabled}
        className="bg-rose-700 hover:bg-rose-800"
      >
        Eliminar
      </Button>
    );
  return (
    <div className="min-w-64 space-y-2">
      <p className="text-xs font-medium text-rose-800" role="alert">
        ¿Eliminar esta operación? Esta acción no se puede deshacer.
      </p>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="transactionId" value={transactionId} />
        <Button
          type="submit"
          disabled={pending}
          className="bg-rose-700 hover:bg-rose-800"
        >
          {pending ? "Eliminando…" : "Confirmar eliminación"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
        >
          Cancelar
        </Button>
      </form>
      {state.status === "error" ? (
        <p className="text-xs text-rose-700" role="alert" aria-live="assertive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function TransactionTable({ rows, assets }: TransactionTableProps) {
  const [active, setActive] = useState<{
    kind: "edit" | "delete";
    id: string;
  } | null>(null);
  if (rows.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="font-medium text-slate-800">Todavía no hay operaciones</p>
        <p className="mt-1 text-sm text-slate-500">
          Las operaciones que guardes aparecerán en este listado.
        </p>
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <Table className="min-w-[1040px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Fecha</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio unitario</TableHead>
            <TableHead className="text-right">Comisión</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ transaction, asset }) => {
            const editing =
              active?.kind === "edit" && active.id === transaction.id;
            const deleting =
              active?.kind === "delete" && active.id === transaction.id;
            return (
              <Fragment key={transaction.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap text-xs text-slate-600">
                    <LocalDateTime iso={transaction.transactionDate} />
                  </TableCell>
                  <TableCell>
                    <div className="min-w-32">
                      <p className="font-semibold text-slate-900">
                        {asset?.symbol ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {asset?.name ?? "Activo no disponible"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${transaction.type === "BUY" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                    >
                      {transaction.type}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                    {formatDecimal(transaction.quantity)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                    {formatDecimal(transaction.unitPrice)} USD
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                    {formatDecimal(transaction.fees)} USD
                  </TableCell>
                  <TableCell className="max-w-56 text-sm">
                    {transaction.notes || (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          setActive({ kind: "edit", id: transaction.id })
                        }
                        disabled={Boolean(active)}
                        className="bg-sky-700 hover:bg-sky-800"
                      >
                        Editar
                      </Button>
                      <DeleteControls
                        transactionId={transaction.id}
                        active={deleting}
                        disabled={Boolean(active && !deleting)}
                        onActivate={() =>
                          setActive({ kind: "delete", id: transaction.id })
                        }
                        onCancel={() => setActive(null)}
                        onDeleted={() => setActive(null)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                {editing ? (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-sky-50 p-5">
                      <div className="mx-auto max-w-4xl">
                        <p className="mb-4 text-sm font-semibold text-sky-900">
                          Editar operación de {asset?.symbol ?? "activo"}
                        </p>
                        <EditTransactionForm
                          assets={assets}
                          transaction={transaction}
                          onCancel={() => setActive(null)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
