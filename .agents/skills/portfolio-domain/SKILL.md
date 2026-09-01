---
name: portfolio-domain
description: Implement or review Portfolio Tracker financial-domain calculations, including holdings, weighted-average cost, fees, realized and unrealized P/L, returns, and decimal precision. Use for domain logic and its tests; do not use for UI-only, database-only, or market-provider-only work.
---

# Portfolio financial domain

Build financial behavior from the transaction ledger, keeping the domain independent from React, Drizzle, and external price providers.

## Required invariants

- Treat persisted BUY and SELL operations as the source of truth; do not persist a mutable "current quantity" as the authoritative value.
- Process transactions in deterministic chronological order. When timestamps tie, use a stable secondary key defined by the application.
- Use weighted-average cost for current project requirements.
- Include buy fees in acquired cost and sale fees in realized proceeds.
- A partial sale reduces the remaining cost basis at the pre-sale average cost; it must not recalculate that average from the sale price.
- A fully closed position has zero quantity and zero remaining cost basis. Normalize harmless decimal residue rather than leaking tiny phantom positions.
- Reject or explicitly handle a sale exceeding the available quantity. Never silently create a short position because short selling is outside the current scope.
- Define behavior for zero cost basis before dividing to calculate a percentage.

## Numeric handling

- Do not perform financial arithmetic with native JavaScript `number` values.
- Accept decimal values from persistence through an explicit boundary type, use a decimal-arithmetic library in the domain, and serialize deliberately at external boundaries.
- Do not round intermediate calculations for display. Apply display rounding only in formatting code.
- Preserve enough scale for crypto quantities and monetary fees.

## Implementation shape

Prefer small pure functions or a cohesive domain service that accepts normalized transactions and returns explicit results such as quantity, average cost, remaining cost basis, and realized P/L. Add market price only when calculating market value and unrealized results; the ledger calculation itself must work without an API.

Keep formulas in one domain location. UI components, route handlers, and repositories may call the domain but must not reproduce its formulas.

## Verification

Test behavior rather than implementation details. Cover at least:

- one BUY;
- multiple BUYs with weighted-average cost;
- partial SELL;
- complete close;
- buy and sale fees;
- several buy/sell cycles;
- high-precision crypto quantities;
- overselling rejection;
- deterministic ordering;
- zero-quantity and zero-cost percentage edge cases.

Use exact decimal assertions where possible. If a task changes a financial rule, state the old and new rule and its effect before implementing it, because project-level decisions require discussion.
