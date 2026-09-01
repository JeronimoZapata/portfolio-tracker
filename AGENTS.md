# Portfolio Tracker — project context

This file is persistent architectural and functional context for the entire repository. It is not a request to implement the whole product. Work only on the concrete task the user asks for, one feature at a time. Before each implementation, inspect the current repository, make only the necessary changes, validate them, and stop without advancing into unrequested roadmap items.

If a future request conflicts with a decision recorded here, explain the conflict and discuss the change before altering the architecture.

## Product goal and constraints

- Build a small, correct, maintainable personal web application for manually recording and tracking investments.
- There is one user, very low traffic, few transactions, and no need for high availability.
- The user manually records every purchase and sale. Do not integrate brokers or automatically import trades.
- Initial asset classes: US stocks, US ETFs, and cryptocurrencies.
- Out of initial scope: CEDEARs, Argentine stocks and bonds, options, futures, broker integrations, dividends, corporate actions, market-price history, portfolio-history charts, benchmarks, ARS conversion, CSV import/export, and advanced metrics.
- Base currency is USD. Initial market prices are also requested in USD.
- Fundamental cost constraint: keep operating cost at USD 0/month using free tiers. Before adding an external service, evaluate its free tier, limits, card requirements, overage behavior, and potential automatic charges. Never add a paid service without discussing it first.
- Prefer simple, correct, testable, maintainable, and free solutions over distributed, complex, enterprise, or overengineered ones.

## Fixed initial architecture

- Framework: Next.js + TypeScript.
- Frontend: React, Tailwind CSS, and shadcn/ui.
- Backend: Next.js server-side capabilities such as Route Handlers, Server Actions when appropriate, and server-only functions.
- Keep frontend and backend in the same project unless a strong technical reason emerges and is discussed first.
- Database: Neon PostgreSQL free tier.
- ORM: Drizzle ORM, with explicit schema control and versioned migrations.
- Hosting: Vercel Hobby, initially using the free `*.vercel.app` domain.
- Authentication: Auth.js, with a single allowed user through Google or GitHub OAuth and an email or identifier allowlist. Avoid storing passwords.
- US stock and ETF market data: Alpaca Market Data API only, using available free/IEX/delayed feeds. Do not use Alpaca for trading.
- Crypto market data: CoinGecko Demo API.
- Operations: manual BUY and SELL.
- Market-price updates: on demand while the user uses the app, optionally via an “Actualizar precios” button.
- Do not introduce microservices, Kubernetes, an independent NestJS/Django/FastAPI/Express backend, always-on processes, permanent WebSockets, continuous polling, or price-fetching cron jobs.

Do not change these choices without first explaining and discussing a concrete technical reason.

## Market-data behavior

- The application is for wealth tracking, not algorithmic trading or order execution. Delayed prices and several minutes of latency are acceptable; zero cost takes priority over absolute timeliness.
- When loading or refreshing the dashboard, the server determines current holdings, requests relevant market prices, calculates the portfolio, and returns the result.
- API calls and credentials must remain server-side. Never expose Alpaca or CoinGecko keys to the browser.
- Batch symbols whenever a provider permits it. Avoid one request per asset.
- Business logic must not depend directly on a vendor. Define a market-data provider abstraction, conceptually supporting `getPrices(symbols)` and implementations such as Alpaca and CoinGecko providers.
- Keep `symbol` distinct from the provider identifier: for example, BTC may map to CoinGecko identifier `bitcoin`.
- External failures must degrade gracefully. Handle timeouts, rate limits, unavailable providers, unknown tickers, and partial responses; one missing price must not break the entire dashboard.
- A small 30–60 second cache may be considered, using the simplest MVP-appropriate mechanism (memory, database, or Next.js/Vercel cache). Do not build complex cache infrastructure.
- Full market-price history is not required initially.

## Data model

Persist operations, not only current balances.

### Asset

Conceptual fields:

- `id`
- `symbol`
- `name`
- `type`: initially `STOCK`, `ETF`, or `CRYPTO`
- `provider`
- `providerIdentifier`
- `currency`
- `exchange`
- `createdAt`
- `updatedAt`

### Transaction

Conceptual fields:

- `id`
- `assetId`
- `type`: initially `BUY` or `SELL`
- `quantity`
- `unitPrice`
- `currency`
- `fees`
- `transactionDate`
- `notes`
- `createdAt`
- `updatedAt`

Design BUY and SELL support from the start even if early usage is purchase-heavy. Keep the model evolvable for future events such as dividends, stock splits, reverse splits, mergers, and ticker changes without implementing them in the MVP.

## Portfolio calculations

- Preferred cost method: weighted-average cost.
- Centralize all financial calculations in the domain layer. Never duplicate them in React components.
- Calculate at minimum current quantity, average cost, invested capital/cost basis of current positions, current market value, unrealized profit/loss, unrealized return percentage, realized profit/loss, and total result.
- Current quantity is purchases minus sales.
- Current market value is current quantity multiplied by market price.
- Unrealized P/L is market value minus the remaining position cost.
- Return percentage is unrealized P/L divided by the remaining position cost, multiplied by 100.
- Total result is realized plus unrealized P/L.
- Fees must be included correctly in cost and realized/unrealized results.
- Do not use naive JavaScript floating-point arithmetic for financial values. Use PostgreSQL `numeric`/`decimal` plus a suitable decimal-arithmetic strategy in TypeScript.
- Support high precision for cryptocurrency quantities such as `0.00015382 BTC`.

## Separation of responsibilities

Keep UI, application services, financial/domain calculations, repositories, database access, and external integrations separated. A rigid Clean Architecture is not required if it adds needless complexity.

Conceptually:

```text
UI
  -> Application services
    -> Domain / portfolio calculations
      -> Repositories
        -> Database

Application
  -> MarketDataService
    -> MarketDataProvider
      -> AlpacaProvider
      -> CoinGeckoProvider
```

## Security and operations

- Store secrets only in environment variables, including `DATABASE_URL`, `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `COINGECKO_API_KEY`, and `AUTH_SECRET`.
- Never commit `.env`, API keys, database URLs, or other secrets. Provide `.env.example` without real secrets when configuration is implemented.
- Keep logging simple and cover important database, Alpaca, CoinGecko, and authentication errors. Vercel logs are enough for the MVP; do not add paid observability.
- Use Git/GitHub with small, coherent commits and a correct `.gitignore`.
- Intended deployment flow is GitHub -> Vercel -> production, with production environment variables configured in Vercel and Neon hosting PostgreSQL.
- No self-managed server, production Docker requirement, reverse proxy, Cloudflare Tunnel, or complex CI/CD is initially needed.

## Planned product surfaces

These are planned destinations, not instructions to create them until requested:

- Dashboard: portfolio value, total invested, unrealized P/L, realized P/L, total return percentage, and allocation summary.
- Portfolio/Holdings: asset, quantity, average cost, market price, market value, cost basis, P/L, and P/L percentage.
- Transactions: date, asset, type, quantity, price, fees, and total, with add/edit/delete behavior.
- New Transaction: asset, BUY/SELL, quantity, unit price, fees, date, and notes.
- Asset Detail: position metrics and transaction history.
- Settings: minimal settings such as base currency USD.

Charts are not an early priority. First ensure the data model, calculations, persistence, and market data are correct. Portfolio history requires a later explicit decision between historical provider data, stored daily snapshots, or a combination.

## Testing priorities

Give special attention to unit tests for financial-domain logic. At minimum cover:

- One purchase: quantity and average cost.
- Multiple purchases: weighted-average cost.
- Partial sale: remaining quantity, remaining cost, and realized gain/loss.
- Full close: zero remaining quantity and correct realized result.
- Fee effects.
- Cryptocurrency quantities with many decimal places.

## Working method

For every requested feature:

1. Inspect the current repository state.
2. Identify and briefly explain the relevant technical decision.
3. Implement only that requested functionality.
4. Run proportionate validation and tests.
5. Review and summarize the result.
6. Wait for the next concrete request.

Do not automatically continue into adjacent features.

## Tentative roadmap

This ordering is contextual and may be adjusted; it is not an instruction to begin work:

1. Bootstrap Next.js, TypeScript, Tailwind, shadcn/ui, ESLint, base structure, and environment configuration.
2. Configure Neon and Drizzle, migrations, Asset, and Transaction tables.
3. Implement and test holdings, weighted-average cost, realized/unrealized P/L, and fees without external APIs.
4. Build Asset and Transaction CRUD, including create, list, edit, and delete.
5. Derive current positions, average cost, and invested capital solely from operations.
6. Add the provider abstraction and batch Alpaca stock/ETF pricing.
7. Add batch CoinGecko cryptocurrency pricing.
8. Combine holdings and market prices in the dashboard.
9. Add Auth.js single-user access; move earlier only for a practical reason.
10. Refine responsive UX, loading/error/empty states, tables, and dashboard visuals.
11. Deploy through GitHub, Vercel, and Neon with production environment variables.
12. Only later evaluate dividends, charts, portfolio history, SPY benchmark, ARS conversion, snapshots, CSV import/export, and advanced metrics.
