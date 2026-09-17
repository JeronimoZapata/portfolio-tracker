"use client";

import { useActionState, useEffect, useState } from "react";

import type { Asset, Transaction } from "@/domain/portfolio";
import {
  createTransactionAction,
  initialTransactionActionState,
  updateTransactionAction,
} from "./actions";
import type {
  TransactionActionState,
  TransactionFormField,
} from "./action-handler";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

type TransactionFormProps = { readonly assets: Asset[] };
type TransactionFormFieldsProps = TransactionFormProps & {
  readonly action: (formData: FormData) => void;
  readonly state: TransactionActionState;
  readonly pending: boolean;
  readonly mode: "create" | "edit";
  readonly transaction?: Transaction;
  readonly onCancel?: () => void;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function isoToLocalDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

function currentLocalDateTime(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function ErrorText({
  field,
  state,
}: {
  readonly field: TransactionFormField;
  readonly state: TransactionActionState;
}) {
  const message = state.fieldErrors?.[field];
  return message ? (
    <p className="mt-1 text-xs text-rose-700" role="alert">
      {message}
    </p>
  ) : null;
}

function TransactionFormFields({
  assets,
  action,
  state,
  pending,
  mode,
  transaction,
  onCancel,
}: TransactionFormFieldsProps) {
  const hasAssets = assets.length > 0;
  const prefix = mode === "edit" ? `edit-${transaction?.id}` : "create";
  const initialDateIso =
    transaction?.transactionDate ?? localDateTimeToIso(currentLocalDateTime());
  const [dateLocal, setDateLocal] = useState(
    transaction
      ? isoToLocalDateTime(transaction.transactionDate)
      : currentLocalDateTime(),
  );
  const [dateIso, setDateIso] = useState(initialDateIso);

  useEffect(() => {
    if (mode === "edit" && state.status === "success") onCancel?.();
  }, [mode, onCancel, state.status]);

  function handleDateChange(value: string) {
    setDateLocal(value);
    setDateIso(localDateTimeToIso(value));
  }

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" ? (
        <input
          type="hidden"
          name="transactionId"
          value={transaction?.id ?? ""}
        />
      ) : null}
      <fieldset disabled={!hasAssets || pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${prefix}-assetId`}>Activo</Label>
            <Select
              id={`${prefix}-assetId`}
              name="assetId"
              defaultValue={transaction?.assetId ?? ""}
              required
            >
              <option value="" disabled>
                Seleccioná un activo
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} — {asset.name}
                </option>
              ))}
            </Select>
            <ErrorText field="assetId" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-type`}>Tipo de operación</Label>
            <Select
              id={`${prefix}-type`}
              name="type"
              defaultValue={transaction?.type ?? "BUY"}
              required
            >
              <option value="BUY">BUY · Compra</option>
              <option value="SELL">SELL · Venta</option>
            </Select>
            <ErrorText field="type" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-transactionDateLocal`}>
              Fecha y hora
            </Label>
            <Input
              id={`${prefix}-transactionDateLocal`}
              type="datetime-local"
              step="1"
              value={dateLocal}
              onChange={(event) => handleDateChange(event.target.value)}
              required
              aria-describedby={`${prefix}-transactionDate-help`}
            />
            <input type="hidden" name="transactionDate" value={dateIso} />
            <p
              id={`${prefix}-transactionDate-help`}
              className="text-xs text-slate-500"
            >
              Se guarda como timestamp ISO con zona horaria.
            </p>
            <ErrorText field="transactionDate" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-quantity`}>Cantidad</Label>
            <Input
              id={`${prefix}-quantity`}
              name="quantity"
              type="text"
              inputMode="decimal"
              placeholder="0.00000000"
              defaultValue={transaction?.quantity ?? ""}
              required
              aria-describedby={`${prefix}-quantity-help`}
            />
            <p
              id={`${prefix}-quantity-help`}
              className="text-xs text-slate-500"
            >
              Podés usar hasta 18 decimales.
            </p>
            <ErrorText field="quantity" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-unitPrice`}>Precio unitario (USD)</Label>
            <Input
              id={`${prefix}-unitPrice`}
              name="unitPrice"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={transaction?.unitPrice ?? ""}
              required
            />
            <ErrorText field="unitPrice" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-fees`}>Comisión</Label>
            <Input
              id={`${prefix}-fees`}
              value="0"
              readOnly
              aria-readonly="true"
            />
            <p className="text-xs text-slate-500">
              La comisión es fija en 0 por ahora.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-currency`}>Moneda</Label>
            <Input
              id={`${prefix}-currency`}
              value="USD"
              readOnly
              aria-readonly="true"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${prefix}-notes`}>Notas (opcional)</Label>
            <Textarea
              id={`${prefix}-notes`}
              name="notes"
              placeholder="Ej. Compra periódica"
              rows={3}
              defaultValue={transaction?.notes ?? ""}
            />
            <ErrorText field="notes" state={state} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!hasAssets || pending}>
            {pending
              ? mode === "edit"
                ? "Guardando cambios…"
                : "Guardando…"
              : mode === "edit"
                ? "Guardar cambios"
                : "Guardar operación"}
          </Button>
          {mode === "edit" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </fieldset>
      {!hasAssets ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Todavía no hay activos disponibles. Cargá un activo antes de registrar
          una operación.
        </p>
      ) : null}
      {state.status === "success" ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          role="alert"
          aria-live="assertive"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function TransactionForm({ assets }: TransactionFormProps) {
  const [state, formAction, pending] = useActionState(
    createTransactionAction,
    initialTransactionActionState,
  );
  return (
    <TransactionFormFields
      key={state.transactionId ?? "draft"}
      assets={assets}
      action={formAction}
      state={state}
      pending={pending}
      mode="create"
    />
  );
}

export function EditTransactionForm({
  assets,
  transaction,
  onCancel,
}: TransactionFormProps & {
  readonly transaction: Transaction;
  readonly onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateTransactionAction,
    initialTransactionActionState,
  );
  return (
    <TransactionFormFields
      assets={assets}
      transaction={transaction}
      action={formAction}
      state={state}
      pending={pending}
      mode="edit"
      onCancel={onCancel}
    />
  );
}
