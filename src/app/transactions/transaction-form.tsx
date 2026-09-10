"use client";

import { useActionState, useRef, useState } from "react";

import type { Asset } from "@/domain/portfolio";
import {
  createTransactionAction,
  initialTransactionActionState,
} from "./actions";
import type {
  TransactionActionState,
  TransactionFormField,
} from "./action-handler";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

type TransactionFormProps = {
  readonly assets: Asset[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function currentLocalDateTime(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

type TransactionFormFieldsProps = TransactionFormProps & {
  readonly action: (formData: FormData) => void;
  readonly state: TransactionActionState;
  readonly pending: boolean;
};

function TransactionFormFields({
  assets,
  action,
  state,
  pending,
}: TransactionFormFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dateLocal, setDateLocal] = useState(currentLocalDateTime);
  const [dateIso, setDateIso] = useState(() =>
    localDateTimeToIso(currentLocalDateTime()),
  );
  const hasAssets = assets.length > 0;

  function handleDateChange(value: string) {
    setDateLocal(value);
    setDateIso(localDateTimeToIso(value));
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <fieldset disabled={!hasAssets || pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="assetId">Activo</Label>
            <Select id="assetId" name="assetId" defaultValue="" required>
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
            <Label htmlFor="type">Tipo de operación</Label>
            <Select id="type" name="type" defaultValue="BUY" required>
              <option value="BUY">BUY · Compra</option>
              <option value="SELL">SELL · Venta</option>
            </Select>
            <ErrorText field="type" state={state} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionDateLocal">Fecha y hora</Label>
            <Input
              id="transactionDateLocal"
              type="datetime-local"
              value={dateLocal}
              onChange={(event) => handleDateChange(event.target.value)}
              required
              aria-describedby="transactionDate-help"
            />
            <input type="hidden" name="transactionDate" value={dateIso} />
            <p id="transactionDate-help" className="text-xs text-slate-500">
              Se guarda como timestamp ISO con zona horaria.
            </p>
            <ErrorText field="transactionDate" state={state} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              name="quantity"
              type="text"
              inputMode="decimal"
              placeholder="0.00000000"
              required
              aria-describedby="quantity-help"
            />
            <p id="quantity-help" className="text-xs text-slate-500">
              Podés usar hasta 18 decimales.
            </p>
            <ErrorText field="quantity" state={state} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unitPrice">Precio unitario (USD)</Label>
            <Input
              id="unitPrice"
              name="unitPrice"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
            <ErrorText field="unitPrice" state={state} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fees">Comisión</Label>
            <Input id="fees" value="0" readOnly aria-readonly="true" />
            <p className="text-xs text-slate-500">
              La comisión es fija en 0 por ahora.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" value="USD" readOnly aria-readonly="true" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Ej. Compra periódica"
              rows={3}
            />
            <ErrorText field="notes" state={state} />
          </div>
        </div>

        <Button
          type="submit"
          disabled={!hasAssets || pending}
          className="w-full sm:w-auto"
        >
          {pending ? "Guardando…" : "Guardar operación"}
        </Button>
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
  const formKey = state.transactionId ?? "draft";
  return (
    <TransactionFormFields
      key={formKey}
      assets={assets}
      action={formAction}
      state={state}
      pending={pending}
    />
  );
}
