---
name: portfolio-market-data
description: Implement or review Portfolio Tracker market-price integrations using Alpaca for US stocks/ETFs and CoinGecko for crypto, with provider abstraction, batching, server-only secrets, short caching, and partial-failure handling. Use for current-price retrieval and provider orchestration; do not use for trading, broker imports, or historical charting.
---

# Portfolio market data

Retrieve on-demand current or delayed prices at zero monthly cost without coupling portfolio logic to a vendor.

## Provider boundary

- Define an application-facing provider contract returning normalized price results with asset identity, price, currency, provider, and observation timestamp.
- Keep Alpaca and CoinGecko response types, identifiers, authentication, and error formats inside their adapters.
- Route US stocks and ETFs to Alpaca Market Data and cryptocurrencies to CoinGecko Demo. Do not use Alpaca trading endpoints.
- Preserve the distinction between display symbol and provider identifier, such as `BTC` versus `bitcoin`.
- Keep prices unavailable rather than inventing zero values, because zero is a valid financial value with different semantics.

## Request behavior

- Call providers from server-only code. Never expose API keys or secrets in client bundles, browser requests, logs, fixtures, or committed files.
- Batch all requested identifiers supported by the same provider and deduplicate them before making a request.
- Fetch only assets relevant to current holdings unless the concrete feature requires otherwise.
- Use bounded timeouts and interpret rate limits and provider failures explicitly.
- Support partial success: return available prices and structured unavailable/error results for the rest so one provider or symbol cannot break the whole portfolio.
- Preserve provider timestamps when available and mark their absence rather than pretending the server receipt time is the market observation time.

## Cache and freshness

Use on-demand retrieval, not continuous polling, permanent WebSockets, background workers, or price-fetching cron jobs. If caching is requested, prefer the simplest mechanism compatible with the runtime and use a short 30-60 second freshness window. Define the cache key by provider, provider identifier, and quote currency.

Do not add permanent price history or daily snapshots as part of current-price work.

## Cost and API changes

Before depending on a provider endpoint or feature, verify current official documentation for free-tier availability, authentication, batching limits, rate limits, feed/delay characteristics, and overage behavior. If it can incur charges, require user discussion before adoption.

Keep provider limits configurable where appropriate; do not scatter vendor constants through business logic.

## Verification

Test adapters with representative mocked provider responses, including batch success, unknown identifiers, partial data, rate limits, timeouts, malformed payloads, and authentication failures. Test the orchestration layer independently from real external accounts. Do not require live paid or credentialed calls for the normal test suite.
