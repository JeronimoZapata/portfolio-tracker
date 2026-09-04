import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("PostgreSQL persistence constraints", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let assetId: string;

  beforeAll(async () => {
    const asset = await pool.query(
      `insert into assets (symbol, name, type, provider, provider_identifier)
       values ('TEST', 'Integration Test', 'STOCK', 'ALPACA', 'integration-test')
       returning id`,
    );
    assetId = asset.rows[0].id;
  });

  afterAll(async () => {
    await pool.query("delete from transactions where asset_id = $1", [assetId]);
    await pool.query("delete from assets where id = $1", [assetId]);
    await pool.end();
  });

  async function expectRejected(query: string, values: unknown[]) {
    await expect(pool.query(query, values)).rejects.toThrow();
  }

  it("stores high-precision values and orders equal dates by id", async () => {
    const firstId = "00000000-0000-0000-0000-000000000001";
    const secondId = "00000000-0000-0000-0000-000000000002";
    const date = "2025-01-01T00:00:00.000Z";
    await pool.query(
      `insert into transactions (id, asset_id, type, quantity, unit_price, transaction_date)
       values ($1, $3, 'BUY', $4, $5, $2), ($6, $3, 'BUY', $7, $8, $2)`,
      [
        firstId,
        date,
        assetId,
        "0.000153820000000001",
        "12345.678901234567",
        secondId,
        "1.000000000000000001",
        "10.000000000001",
      ],
    );
    const result = await pool.query(
      `select id, quantity::text, unit_price::text from transactions
       where asset_id = $1 order by transaction_date, id`,
      [assetId],
    );
    expect(result.rows.map((row) => row.id)).toEqual([firstId, secondId]);
    expect(result.rows[0].quantity).toBe("0.000153820000000001");
    expect(result.rows[0].unit_price).toBe("12345.678901234567");
  });

  it("rejects invalid transaction values and currencies", async () => {
    const values = [assetId, new Date().toISOString()];
    await expectRejected(
      `insert into transactions (asset_id, type, quantity, unit_price, transaction_date)
       values ($1, 'BUY', 0, 1, $2)`,
      values,
    );
    await expectRejected(
      `insert into transactions (asset_id, type, quantity, unit_price, transaction_date)
       values ($1, 'BUY', 1, -1, $2)`,
      values,
    );
    await expectRejected(
      `insert into transactions (asset_id, type, quantity, unit_price, fees, transaction_date)
       values ($1, 'BUY', 1, 1, 0.01, $2)`,
      values,
    );
    await expectRejected(
      `insert into transactions (asset_id, type, quantity, unit_price, currency, transaction_date)
       values ($1, 'BUY', 1, 1, 'EUR', $2)`,
      values,
    );
  });

  it("enforces provider identity, type/provider consistency and restricted deletion", async () => {
    await expectRejected(
      `insert into assets (symbol, name, type, provider, provider_identifier)
       values ('DUP', 'Duplicate', 'STOCK', 'ALPACA', 'integration-test')`,
      [],
    );
    await expectRejected(
      `insert into assets (symbol, name, type, provider, provider_identifier)
       values ('BAD', 'Bad provider', 'CRYPTO', 'ALPACA', 'bad-provider')`,
      [],
    );
    await expectRejected("delete from assets where id = $1", [assetId]);
  });
});
