import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const assetTypeEnum = pgEnum("asset_type", ["STOCK", "ETF", "CRYPTO"]);
export const assetProviderEnum = pgEnum("asset_provider", [
  "ALPACA",
  "COINGECKO",
]);
export const transactionTypeEnum = pgEnum("transaction_type", ["BUY", "SELL"]);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull(),
    provider: assetProviderEnum("provider").notNull(),
    providerIdentifier: text("provider_identifier").notNull(),
    currency: text("currency").notNull().default("USD"),
    exchange: text("exchange"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerIdentifierUnique: unique().on(
      table.provider,
      table.providerIdentifier,
    ),
    symbolNotEmpty: check(
      "assets_symbol_not_empty",
      sql`length(trim(${table.symbol})) > 0`,
    ),
    nameNotEmpty: check(
      "assets_name_not_empty",
      sql`length(trim(${table.name})) > 0`,
    ),
    providerIdentifierNotEmpty: check(
      "assets_provider_identifier_not_empty",
      sql`length(trim(${table.providerIdentifier})) > 0`,
    ),
    currencyUsd: check("assets_currency_usd", sql`${table.currency} = 'USD'`),
    providerMatchesType: check(
      "assets_provider_matches_type",
      sql`(${table.type} in ('STOCK', 'ETF') and ${table.provider} = 'ALPACA') or (${table.type} = 'CRYPTO' and ${table.provider} = 'COINGECKO')`,
    ),
  }),
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 36, scale: 18 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 30, scale: 12 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    fees: numeric("fees", { precision: 30, scale: 12 }).notNull().default("0"),
    transactionDate: timestamp("transaction_date", {
      withTimezone: true,
      precision: 3,
      mode: "date",
    }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    byAssetAndDate: index("transactions_asset_date_idx").on(
      table.assetId,
      table.transactionDate,
      table.id,
    ),
    byDate: index("transactions_date_idx").on(table.transactionDate, table.id),
    quantityPositive: check(
      "transactions_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    unitPriceNonNegative: check(
      "transactions_unit_price_non_negative",
      sql`${table.unitPrice} >= 0`,
    ),
    feesZero: check("transactions_fees_zero", sql`${table.fees} = 0`),
    currencyUsd: check(
      "transactions_currency_usd",
      sql`${table.currency} = 'USD'`,
    ),
  }),
);

export type AssetRow = typeof assets.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewAssetRow = typeof assets.$inferInsert;
export type NewTransactionRow = typeof transactions.$inferInsert;
