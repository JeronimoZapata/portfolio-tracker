"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import type { Asset, AssetType } from "@/domain/portfolio";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createAssetAction,
  initialAssetActionState,
  updateAssetAction,
} from "./actions";
import type { AssetActionState, AssetFormField } from "./action-handler";

type AssetFormProps = {
  readonly asset?: Asset;
  readonly onCancel?: () => void;
};

type ProviderCandidate = {
  readonly provider: "ALPACA" | "COINGECKO";
  readonly providerIdentifier: string;
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string | null;
  readonly marketCapRank?: number | null;
};

type AssetFormFieldsProps = AssetFormProps & {
  readonly action: (formData: FormData) => void;
  readonly state: AssetActionState;
  readonly pending: boolean;
  readonly mode: "create" | "edit";
};

type SearchStatus = "idle" | "loading";

function ErrorText({
  field,
  state,
}: {
  readonly field: AssetFormField;
  readonly state: AssetActionState;
}) {
  const message = state.fieldErrors?.[field];
  return message ? (
    <p className="mt-1 text-xs text-rose-700" role="alert">
      {message}
    </p>
  ) : null;
}

function providerForType(type: AssetType): "ALPACA" | "COINGECKO" {
  return type === "CRYPTO" ? "COINGECKO" : "ALPACA";
}

function searchErrorMessage(status: number): string {
  if (status === 429) {
    return "El proveedor alcanzó su límite de solicitudes. Esperá unos segundos e intentá nuevamente.";
  }
  return "No pudimos buscar el activo en el proveedor. Intentá nuevamente.";
}

function AssetFormFields({
  asset,
  action,
  state,
  pending,
  mode,
  onCancel,
}: AssetFormFieldsProps) {
  const [type, setType] = useState<AssetType>(asset?.type ?? "STOCK");
  const [symbol, setSymbol] = useState(asset?.symbol ?? "");
  const [name, setName] = useState(asset?.name ?? "");
  const [exchange, setExchange] = useState(asset?.exchange ?? "");
  const [selectedIdentifier, setSelectedIdentifier] = useState(
    asset?.providerIdentifier ?? "",
  );
  const [searchQuery, setSearchQuery] = useState(asset?.symbol ?? "");
  const [candidates, setCandidates] = useState<ProviderCandidate[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [debouncePending, setDebouncePending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [identityChanged, setIdentityChanged] = useState(false);
  const provider = providerForType(type);
  const prefix = mode === "edit" ? `edit-${asset?.id}` : "create";

  useEffect(() => {
    if (mode === "edit" && state.status === "success") onCancel?.();
  }, [mode, onCancel, state.status]);

  const changeType = (nextType: AssetType) => {
    setType(nextType);
    setSelectedIdentifier("");
    setIdentityChanged(true);
    setSymbol("");
    setSearchQuery("");
    setCandidates([]);
    setSearchError(null);
    if (nextType === "CRYPTO") setExchange("");
  };

  const searchProvider = useCallback(async () => {
    setDebouncePending(false);
    const query = searchQuery.trim();
    if (!query) {
      setSearchError("Ingresá un símbolo o nombre para buscar.");
      setCandidates([]);
      setSearchOpen(true);
      return;
    }
    setSearchStatus("loading");
    setSearchError(null);
    setSearchOpen(true);
    try {
      const response = await fetch(
        `/api/assets/search?type=${encodeURIComponent(type)}&query=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setCandidates([]);
        setSearchError(searchErrorMessage(response.status));
        return;
      }
      const data = (await response.json()) as {
        candidates?: ProviderCandidate[];
      };
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      if (!data.candidates?.length) {
        setSearchError("No encontramos activos con esa búsqueda.");
      }
    } catch {
      setCandidates([]);
      setSearchError("No pudimos buscar el activo en el proveedor.");
    } finally {
      setSearchStatus("idle");
    }
  }, [searchQuery, type]);

  useEffect(() => {
    if (!debouncePending) return;
    if (!searchQuery.trim() || selectedIdentifier) return;
    const timeout = setTimeout(() => {
      setDebouncePending(false);
      void searchProvider();
    }, 350);
    return () => clearTimeout(timeout);
  }, [debouncePending, searchQuery, searchProvider, selectedIdentifier]);

  const selectCandidate = (candidate: ProviderCandidate) => {
    setSelectedIdentifier(candidate.providerIdentifier);
    setIdentityChanged(true);
    setSymbol(candidate.symbol);
    setName(candidate.name);
    if (type !== "CRYPTO") setExchange(candidate.exchange ?? "");
    setSearchQuery(candidate.symbol);
    setCandidates([]);
    setSearchOpen(false);
    setSearchError(null);
  };

  return (
    <form
      action={action}
      className="space-y-5"
      id={mode === "create" ? "asset-form" : undefined}
    >
      {mode === "edit" ? (
        <input type="hidden" name="assetId" value={asset?.id ?? ""} />
      ) : null}
      <input
        type="hidden"
        name="providerIdentifier"
        value={selectedIdentifier}
        readOnly
      />
      {mode === "edit" ? (
        <input
          type="hidden"
          name="identityChanged"
          value={identityChanged ? "true" : "false"}
          readOnly
        />
      ) : null}
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${prefix}-provider-search`}>
              Buscar activo en {provider}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`${prefix}-provider-search`}
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedIdentifier("");
                  setSymbol("");
                  setDebouncePending(true);
                  setSearchError(null);
                }}
                placeholder={
                  provider === "ALPACA"
                    ? "Ticker, por ejemplo AAPL"
                    : "Nombre o símbolo, por ejemplo bitcoin"
                }
                aria-describedby={`${prefix}-provider-search-help`}
              />
              <Button
                type="button"
                onClick={searchProvider}
                disabled={searchStatus === "loading"}
                className="shrink-0 bg-slate-700 hover:bg-slate-800"
              >
                {searchStatus === "loading" ? "Buscando…" : "Buscar"}
              </Button>
            </div>
            {mode === "edit" && selectedIdentifier ? (
              <Button
                type="button"
                onClick={() => {
                  setSelectedIdentifier("");
                  setSymbol("");
                  setSearchQuery("");
                  setCandidates([]);
                  setSearchOpen(false);
                  setSearchError(null);
                  setDebouncePending(false);
                }}
                className="bg-sky-100 text-sky-900 hover:bg-sky-200"
              >
                Cambiar activo
              </Button>
            ) : null}
            <p
              id={`${prefix}-provider-search-help`}
              className="text-xs text-slate-500"
            >
              {provider === "ALPACA"
                ? "La consulta es exacta y devuelve el ticker canónico de Alpaca."
                : "Elegí un resultado para guardar el identificador único de CoinGecko."}
            </p>
            {searchError ? (
              <p className="text-xs text-rose-700" role="alert">
                {searchError}
              </p>
            ) : null}
            {searchOpen && candidates.length > 0 ? (
              <div
                className="space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                role="listbox"
                aria-label="Resultados del proveedor"
              >
                {candidates.map((candidate) => (
                  <button
                    key={`${candidate.provider}-${candidate.providerIdentifier}`}
                    type="button"
                    role="option"
                    aria-selected={
                      candidate.providerIdentifier === selectedIdentifier
                    }
                    onClick={() => selectCandidate(candidate)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-sky-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {candidate.name} ({candidate.symbol})
                      </span>
                      <span className="block font-mono text-xs text-slate-500">
                        {candidate.providerIdentifier}
                        {candidate.exchange ? ` · ${candidate.exchange}` : ""}
                      </span>
                    </span>
                    {candidate.marketCapRank ? (
                      <span className="text-xs text-slate-500">
                        #{candidate.marketCapRank}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <ErrorText field="providerIdentifier" state={state} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}-symbol`}>Símbolo</Label>
            <Input
              id={`${prefix}-symbol`}
              name="symbol"
              type="text"
              value={symbol}
              readOnly
              required
              aria-readonly="true"
            />
            <p className="text-xs text-slate-500">
              Se completa desde el proveedor y se guarda en mayúsculas.
            </p>
            <ErrorText field="symbol" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-name`}>Nombre</Label>
            <Input
              id={`${prefix}-name`}
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Apple Inc."
              required
            />
            <ErrorText field="name" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-type`}>Tipo</Label>
            <Select
              id={`${prefix}-type`}
              name="type"
              value={type}
              onChange={(event) => changeType(event.target.value as AssetType)}
              required
            >
              <option value="STOCK">STOCK · Acción</option>
              <option value="ETF">ETF</option>
              <option value="CRYPTO">CRYPTO · Criptomoneda</option>
            </Select>
            <ErrorText field="type" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-provider`}>Proveedor</Label>
            <Input
              id={`${prefix}-provider`}
              value={provider}
              readOnly
              aria-readonly="true"
            />
            <p className="text-xs text-slate-500">
              Se asigna automáticamente según el tipo.
            </p>
            <ErrorText field="provider" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-exchange`}>
              Exchange{type === "CRYPTO" ? " (opcional)" : ""}
            </Label>
            <Input
              id={`${prefix}-exchange`}
              name="exchange"
              type="text"
              value={exchange}
              onChange={(event) => setExchange(event.target.value)}
              placeholder="NASDAQ"
              required={type !== "CRYPTO"}
            />
            <ErrorText field="exchange" state={state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-currency`}>Moneda</Label>
            <Input
              id={`${prefix}-currency`}
              value="USD"
              readOnly
              aria-readonly="true"
            />
            <p className="text-xs text-slate-500">
              La moneda está fijada por las reglas actuales del MVP.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !selectedIdentifier}>
            {pending
              ? mode === "edit"
                ? "Guardando cambios…"
                : "Guardando…"
              : mode === "edit"
                ? "Guardar cambios"
                : "Guardar activo"}
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

export function AssetForm() {
  const [state, formAction, pending] = useActionState(
    createAssetAction,
    initialAssetActionState,
  );
  return (
    <AssetFormFields
      key={state.assetId ?? "draft"}
      action={formAction}
      state={state}
      pending={pending}
      mode="create"
    />
  );
}

export function EditAssetForm({
  asset,
  onCancel,
}: AssetFormProps & { readonly asset: Asset; readonly onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(
    updateAssetAction,
    initialAssetActionState,
  );
  return (
    <AssetFormFields
      asset={asset}
      action={formAction}
      state={state}
      pending={pending}
      mode="edit"
      onCancel={onCancel}
    />
  );
}
