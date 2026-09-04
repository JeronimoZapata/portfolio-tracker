CREATE TYPE "public"."asset_provider" AS ENUM('ALPACA', 'COINGECKO');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('STOCK', 'ETF', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"provider" "asset_provider" NOT NULL,
	"provider_identifier" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_provider_provider_identifier_unique" UNIQUE("provider","provider_identifier"),
	CONSTRAINT "assets_symbol_not_empty" CHECK (length(trim("assets"."symbol")) > 0),
	CONSTRAINT "assets_name_not_empty" CHECK (length(trim("assets"."name")) > 0),
	CONSTRAINT "assets_provider_identifier_not_empty" CHECK (length(trim("assets"."provider_identifier")) > 0),
	CONSTRAINT "assets_currency_usd" CHECK ("assets"."currency" = 'USD'),
	CONSTRAINT "assets_provider_matches_type" CHECK (("assets"."type" in ('STOCK', 'ETF') and "assets"."provider" = 'ALPACA') or ("assets"."type" = 'CRYPTO' and "assets"."provider" = 'COINGECKO'))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"quantity" numeric(36, 18) NOT NULL,
	"unit_price" numeric(30, 12) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"fees" numeric(30, 12) DEFAULT '0' NOT NULL,
	"transaction_date" timestamp (3) with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_quantity_positive" CHECK ("transactions"."quantity" > 0),
	CONSTRAINT "transactions_unit_price_non_negative" CHECK ("transactions"."unit_price" >= 0),
	CONSTRAINT "transactions_fees_zero" CHECK ("transactions"."fees" = 0),
	CONSTRAINT "transactions_currency_usd" CHECK ("transactions"."currency" = 'USD')
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_asset_date_idx" ON "transactions" USING btree ("asset_id","transaction_date","id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("transaction_date","id");