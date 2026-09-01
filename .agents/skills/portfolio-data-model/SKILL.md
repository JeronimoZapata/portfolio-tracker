---
name: portfolio-data-model
description: Design, implement, or review Portfolio Tracker persistence with Neon PostgreSQL and Drizzle, especially Asset and Transaction schemas, numeric precision, migrations, constraints, and repository boundaries. Use for database and persistence tasks; do not use for calculations or provider integrations that do not alter persistence.
---

# Portfolio data model

Model the transaction ledger faithfully in PostgreSQL and keep persistence details outside the financial domain.

## Schema decisions

- Use Neon PostgreSQL and Drizzle unless the user first approves an architectural change.
- Keep `Asset` and `Transaction` as separate entities with a foreign-key relationship.
- Preserve both the user-facing asset `symbol` and the provider-specific identifier.
- Constrain initial asset types to `STOCK`, `ETF`, and `CRYPTO`, and transaction types to `BUY` and `SELL`, using a PostgreSQL/Drizzle representation that produces clear migrations.
- Use timezone-aware timestamps for recorded instants. Treat the user-entered transaction date explicitly; do not let server or database timezone silently shift it.
- Use PostgreSQL `numeric` columns with deliberate precision and scale for quantity, unit price, and fees. Choose scales from domain needs rather than copying one scale to every field.
- Require positive quantities and non-negative prices and fees with database constraints where practical, while also validating at the application boundary.
- Define uniqueness intentionally. A ticker alone may not be globally unique across asset type, exchange, or provider.
- Add indexes only for demonstrated query paths such as transaction lookup/order by asset and date; avoid speculative indexing for a single-user dataset.

## Migration safety

- Make schema changes through versioned Drizzle migrations; do not rely on untracked manual production edits.
- Inspect generated SQL before applying a migration, especially for destructive operations, implicit casts, defaults, enum changes, and precision reductions.
- Never run a destructive or production migration merely because a schema task was requested. Generate and review first unless the user explicitly asks to apply it to a named database.
- Do not place connection strings or credentials in schema, migration, seed, test, or config files. Keep a secret-free `.env.example` when environment configuration is in scope.

## Boundaries

Repositories translate database rows into explicit application/domain types. Do not allow driver-specific numeric strings, nullable behavior, or database naming conventions to leak unpredictably into calculations.

Do not store holdings, average cost, or P/L as primary truth while they can be derived from transactions. Add cached or snapshot data only after a concrete task defines its consistency rules.

## Verification

For schema work, validate the Drizzle configuration and generated migration without requiring a live production database. Add focused persistence tests when repository behavior is implemented. Verify foreign keys, constraints, decimal round trips, stable transaction ordering, and deletion/update behavior requested by the feature.

