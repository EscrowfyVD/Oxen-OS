import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toDecimal,
  serializeMoney,
  serializeMoneyString,
  decimalToNumber,
  sumDecimals,
  multiplyByRate,
  formatMoney,
  isPositive,
} from "./decimal";

describe("toDecimal", () => {
  it("converts a number to Prisma.Decimal", () => {
    const d = toDecimal(100);
    expect(d).toBeInstanceOf(Prisma.Decimal);
    expect(d.toString()).toBe("100");
  });

  it("converts a string to Prisma.Decimal", () => {
    const d = toDecimal("99.99");
    expect(d.toString()).toBe("99.99");
  });

  it("passes through an existing Decimal without re-allocating", () => {
    const input = new Prisma.Decimal("42.42");
    expect(toDecimal(input)).toBe(input);
  });
});

describe("serializeMoney", () => {
  // ⚡ Contract test — locked in Sprint 3.2 Phase 0.
  // 17 frontend reducers expect number, not string.
  it("returns number (not string) for reducer compatibility", () => {
    expect(serializeMoney(new Prisma.Decimal("100.50"))).toBe(100.5);
    expect(typeof serializeMoney(new Prisma.Decimal("100.50"))).toBe("number");
  });

  it("preserves precision for typical monetary values (<1B, 4 decimals)", () => {
    expect(serializeMoney(new Prisma.Decimal("1234567.8901"))).toBe(
      1234567.8901,
    );
  });

  it("returns null for null input", () => {
    expect(serializeMoney(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(serializeMoney(undefined)).toBeNull();
  });

  it("returns 0 for a zero Decimal (not null)", () => {
    expect(serializeMoney(new Prisma.Decimal(0))).toBe(0);
  });
});

describe("serializeMoneyString", () => {
  // ⚡ Contract test — documents the escape hatch Vernon wanted kept.
  it("returns string (for future precision-critical paths)", () => {
    expect(serializeMoneyString(new Prisma.Decimal("100.50"))).toBe("100.5");
    expect(typeof serializeMoneyString(new Prisma.Decimal("100.50"))).toBe(
      "string",
    );
  });

  it("preserves exact decimal text for large values", () => {
    expect(serializeMoneyString(new Prisma.Decimal("1234567890.1234"))).toBe(
      "1234567890.1234",
    );
  });

  it("returns null for null input", () => {
    expect(serializeMoneyString(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(serializeMoneyString(undefined)).toBeNull();
  });
});

describe("decimalToNumber", () => {
  it("converts a Decimal to number", () => {
    expect(decimalToNumber(new Prisma.Decimal("3.14"))).toBe(3.14);
  });
  it("returns null for null/undefined", () => {
    expect(decimalToNumber(null)).toBeNull();
    expect(decimalToNumber(undefined)).toBeNull();
  });
});

describe("Decimal precision (decimal.js vs IEEE 754)", () => {
  it("0.1 + 0.2 equals exactly 0.3 in Decimal land", () => {
    const sum = new Prisma.Decimal("0.1").plus(new Prisma.Decimal("0.2"));
    expect(sum.toString()).toBe("0.3");
    // Float trap witness — this is WHY we migrate to Decimal.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("100 × 0.01 equals exactly 1", () => {
    const product = new Prisma.Decimal("100").times(new Prisma.Decimal("0.01"));
    expect(product.toString()).toBe("1");
  });
});

describe("sumDecimals", () => {
  it("sums an array of Decimals exactly", () => {
    const result = sumDecimals([
      new Prisma.Decimal("10.50"),
      new Prisma.Decimal("20.25"),
      new Prisma.Decimal("5.00"),
    ]);
    expect(result.toString()).toBe("35.75");
  });

  it("sums mixed number / string / Decimal inputs", () => {
    const result = sumDecimals([10, "20.5", new Prisma.Decimal("3.25")]);
    expect(result.toString()).toBe("33.75");
  });

  it("skips null and undefined entries (treated as zero)", () => {
    const result = sumDecimals([10, null, 20, undefined, 5]);
    expect(result.toString()).toBe("35");
  });

  it("returns Decimal(0) for an empty array", () => {
    expect(sumDecimals([]).toString()).toBe("0");
  });

  it("preserves precision on a fan-out of small additions", () => {
    // 10 × 0.1 in Decimal space = exactly 1 (in IEEE would drift).
    const values = Array(10).fill(new Prisma.Decimal("0.1"));
    expect(sumDecimals(values).toString()).toBe("1");
  });
});

describe("multiplyByRate", () => {
  it("computes an FX conversion with full Decimal precision", () => {
    // EUR 100 × USD/EUR 1.08523456 = USD 108.523456 (8-decimal rate).
    const result = multiplyByRate("100.00", "1.08523456");
    expect(result.toString()).toBe("108.523456");
  });

  it("accepts a Decimal × number mix", () => {
    const result = multiplyByRate(new Prisma.Decimal("50"), 2);
    expect(result.toString()).toBe("100");
  });
});

describe("formatMoney", () => {
  it("formats values under 1000 without a suffix", () => {
    expect(formatMoney(new Prisma.Decimal("42"))).toBe("€42");
  });
  it("formats thousands with a K suffix", () => {
    expect(formatMoney(new Prisma.Decimal("1500"))).toBe("€1.5K");
  });
  it("formats millions with an M suffix", () => {
    expect(formatMoney(new Prisma.Decimal("2500000"))).toBe("€2.5M");
  });
  it("handles negative values with a leading minus", () => {
    expect(formatMoney(new Prisma.Decimal("-1500"))).toBe("-€1.5K");
  });
  it("accepts a custom currency prefix", () => {
    expect(formatMoney(100, "$")).toBe("$100");
  });
  it("returns <currency>0 for null / undefined", () => {
    expect(formatMoney(null)).toBe("€0");
    expect(formatMoney(undefined)).toBe("€0");
  });
});

describe("isPositive", () => {
  it("returns true for a positive Decimal", () => {
    expect(isPositive(new Prisma.Decimal("0.01"))).toBe(true);
  });
  it("returns false for a zero Decimal", () => {
    expect(isPositive(new Prisma.Decimal(0))).toBe(false);
  });
  it("returns false for a negative Decimal", () => {
    expect(isPositive(new Prisma.Decimal("-1"))).toBe(false);
  });
  it("returns false for null / undefined", () => {
    expect(isPositive(null)).toBe(false);
    expect(isPositive(undefined)).toBe(false);
  });
  it("works on plain numbers too", () => {
    expect(isPositive(5)).toBe(true);
    expect(isPositive(-5)).toBe(false);
    expect(isPositive(0)).toBe(false);
  });
});
