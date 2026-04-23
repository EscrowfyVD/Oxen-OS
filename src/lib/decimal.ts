import { Prisma } from "@prisma/client";

/**
 * Decimal helpers for the Oxen OS monetary domain.
 *
 * Sprint 3.2 migrates 16 monetary fields from `Float` to Prisma
 * `Decimal(19,4)` (+ `Decimal(19,8)` for FX rates). The helpers in this
 * module standardise the read/write boundary:
 *
 *   • **Database writes** → pass `Decimal | number | string` through
 *     `toDecimal()` to guarantee Prisma receives a safely-constructed
 *     Decimal (avoids float-literal drift for values like `0.1`).
 *
 *   • **API JSON responses** → `serializeMoney()` converts Decimal to
 *     `number` via `.toNumber()`. This is the default path because 17
 *     frontend reducers (`crm/*`, `finance/*`, `conferences/*`) sum field
 *     values with `(sum, v) => sum + v.amount` and have no
 *     `parseFloat`. Returning a string would silently concatenate.
 *     Decision locked in Sprint 3.2 Phase 0 (Option B).
 *
 *   • **Precision-critical exports** → `serializeMoneyString()` preserves
 *     exact decimal text. Reserved for future audit / compliance paths
 *     where bit-exact values matter. Not yet consumed by any route.
 *
 *   • **Backend aggregation** → `sumDecimals()` keeps the running total
 *     in Decimal space so rounding noise doesn't accumulate before the
 *     final `serializeMoney()` conversion at the route boundary.
 *
 * PRECISION BUDGET — IEEE 754 double exactly represents integers up to
 * 2^53 and fractional values with ≤15 significant digits. The Oxen OS
 * monetary domain caps at ~10^9 EUR with 4 decimals = 13 sig figs, well
 * inside the safe zone. If we ever outgrow that (large-ledger exports,
 * multi-currency sums in exotic denominations), switch the hot path to
 * `serializeMoneyString` — the helper is already there.
 */

export type DecimalInput = Prisma.Decimal | number | string;

/**
 * Normalize any numeric input to `Prisma.Decimal` for database writes
 * or further decimal arithmetic.
 *
 * @example
 *   toDecimal(100)          // Decimal("100")
 *   toDecimal("99.99")      // Decimal("99.99")
 *   toDecimal(existing)     // pass-through (no wasted allocation)
 */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Convert a `Prisma.Decimal` to a `number` for JSON API responses.
 *
 * Default serializer at the monolith/worker → client boundary. Returns
 * `null` when the input is null/undefined.
 *
 * See the module-level precision note for when to prefer
 * `serializeMoneyString` instead.
 */
export function serializeMoney(
  value: Prisma.Decimal | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/**
 * Alternative JSON serializer that preserves exact decimal text.
 * Reserved for future precision-critical paths (audit exports,
 * compliance reports). No current consumer — it exists so the option
 * is documented and tested now, not researched later under pressure.
 *
 * @see serializeMoney for the default number-returning variant.
 */
export function serializeMoneyString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

/**
 * Plain Decimal → number conversion, null-aware. Intended for internal
 * arithmetic where you've already left Decimal precision on purpose.
 * Prefer `serializeMoney` at the API response boundary to make intent
 * explicit.
 */
export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/**
 * Sum a list of decimal-compatible values in full `Decimal` precision.
 * Null/undefined entries are skipped (treated as zero).
 *
 * Use this on the backend to aggregate before serializing, instead of
 * `arr.reduce((s, x) => s + x.toNumber())` — the Decimal-space sum
 * cannot accumulate IEEE 754 rounding noise.
 */
export function sumDecimals(
  values: Array<DecimalInput | null | undefined>,
): Prisma.Decimal {
  let acc = new Prisma.Decimal(0);
  for (const v of values) {
    if (v === null || v === undefined) continue;
    acc = acc.plus(toDecimal(v));
  }
  return acc;
}

/**
 * Multiply an amount by an exchange rate (or any multiplier) in
 * `Decimal` precision. Used for FX conversions such as
 * `FinanceTransaction.amount × exchangeRate`.
 */
export function multiplyByRate(
  amount: DecimalInput,
  rate: DecimalInput,
): Prisma.Decimal {
  return toDecimal(amount).times(toDecimal(rate));
}

/**
 * Format a monetary value as a compact display string (`€1.2K`, `€3.4M`).
 * Accepts `Decimal`, `number`, `string`, or null/undefined. Mirrors the
 * shape of `fmtCurrency` in `crm-config.ts` but also takes Decimal
 * directly, so call-sites can stay Decimal-end-to-end when rendering.
 */
export function formatMoney(
  value: Prisma.Decimal | number | string | null | undefined,
  currency = "€",
): string {
  if (value === null || value === undefined) return `${currency}0`;
  const num =
    value instanceof Prisma.Decimal
      ? value.toNumber()
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return `${currency}0`;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000)
    return `${sign}${currency}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${currency}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${currency}${abs.toFixed(0)}`;
}

/**
 * Sign check that tolerates `Decimal | number | null | undefined`.
 * Null/undefined → `false`.
 */
export function isPositive(
  value: Prisma.Decimal | number | null | undefined,
): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Prisma.Decimal) return value.greaterThan(0);
  return value > 0;
}
