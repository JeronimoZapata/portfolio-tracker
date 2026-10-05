"use client";

import { Fragment, useActionState, useEffect, useState } from "react";

import type { Asset } from "@/domain/portfolio";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteAssetAction } from "./actions";
import { EditAssetForm } from "./asset-form";

function DeleteControls({
  assetId,
  active,
  disabled,
  onActivate,
  onCancel,
  onDeleted,
}: {
  readonly assetId: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly onDeleted: () => void;
}) {
  const [state, formAction, pending] = useActionState(deleteAssetAction, {
    status: "idle" as const,
  });

  useEffect(() => {
    if (state.status === "success") onDeleted();
  }, [onDeleted, state.status]);

  if (!active) {
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
  }

  return (
    <div className="min-w-64 space-y-2">
      <p className="text-xs font-medium text-rose-800" role="alert">
        ¿Eliminar este activo? Esta acción no se puede deshacer.
      </p>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="assetId" value={assetId} />
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

export function AssetTable({ assets }: { readonly assets: Asset[] }) {
  const [active, setActive] = useState<{
    kind: "edit" | "delete";
    id: string;
  } | null>(null);

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="font-medium text-slate-800">Todavía no hay activos</p>
        <p className="mt-1 text-sm text-slate-500">
          Registrá el primer activo para empezar a cargar operaciones.
        </p>
        <a
          href="#asset-form"
          className="mt-4 inline-flex rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Registrar un activo
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Símbolo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Identificador</TableHead>
            <TableHead>Exchange</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const editing = active?.kind === "edit" && active.id === asset.id;
            const deleting =
              active?.kind === "delete" && active.id === asset.id;
            return (
              <Fragment key={asset.id}>
                <TableRow>
                  <TableCell className="font-semibold">
                    {asset.symbol}
                  </TableCell>
                  <TableCell>{asset.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {asset.type}
                    </span>
                  </TableCell>
                  <TableCell>{asset.provider}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {asset.providerIdentifier}
                  </TableCell>
                  <TableCell>
                    {asset.exchange ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          setActive({ kind: "edit", id: asset.id })
                        }
                        disabled={Boolean(active)}
                        className="bg-sky-700 hover:bg-sky-800"
                      >
                        Editar
                      </Button>
                      <DeleteControls
                        assetId={asset.id}
                        active={deleting}
                        disabled={Boolean(active && !deleting)}
                        onActivate={() =>
                          setActive({ kind: "delete", id: asset.id })
                        }
                        onCancel={() => setActive(null)}
                        onDeleted={() => setActive(null)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                {editing ? (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-sky-50 p-5">
                      <div className="mx-auto max-w-4xl">
                        <p className="mb-4 text-sm font-semibold text-sky-900">
                          Editar activo {asset.symbol}
                        </p>
                        <EditAssetForm
                          asset={asset}
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
