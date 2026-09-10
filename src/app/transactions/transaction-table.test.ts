import { describe, expect, it } from "vitest";

import { formatDecimal } from "./transaction-table";

describe("transaction display formatting", () => {
  it("formats decimal strings without converting them to numbers", () => {
    expect(formatDecimal("1234567.890000000001")).toBe(
      "1.234.567,890000000001",
    );
    expect(formatDecimal("0.000153820000000001")).toBe("0,000153820000000001");
    expect(formatDecimal("10.000000000000")).toBe("10");
  });
});
