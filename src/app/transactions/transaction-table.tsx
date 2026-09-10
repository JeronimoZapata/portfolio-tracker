import type { TransactionListItem } from "@/server/transactions";
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

export function TransactionTable({ rows }: TransactionTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="font-medium text-slate-800">Todavía no hay operaciones</p>
        <p className="mt-1 text-sm text-slate-500">
          Las operaciones que guardes aparecerán en este listado.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Fecha</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio unitario</TableHead>
            <TableHead className="text-right">Comisión</TableHead>
            <TableHead>Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ transaction, asset }) => (
            <TableRow key={transaction.id}>
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
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                    transaction.type === "BUY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
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
                {transaction.notes || <span className="text-slate-400">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
