/**
 * Centralized Financial Precision Engine
 * Phase 06 Deliverable — Double-Entry Accounting Engine
 *
 * Enforces exact decimal arithmetic without floating-point drift.
 * All monetary calculations use scaled BigInt representation (scale = 4 internally).
 * Centralized rounding algorithms: ROUND_HALF_UP, ROUND_HALF_EVEN (Banker's), ROUND_FLOOR, ROUND_CEIL.
 */

export type RoundingMode = 'ROUND_HALF_UP' | 'ROUND_HALF_EVEN' | 'ROUND_FLOOR' | 'ROUND_CEIL';

export class FinancialAmount {
  private static readonly SCALE = 4;
  private static readonly MULTIPLIER = 10000n; // 10^4

  // The raw scaled integer value: e.g. 100.5000 is stored as 1005000n
  private readonly raw: bigint;

  private constructor(raw: bigint) {
    this.raw = raw;
  }

  /**
   * Factory method: Parses string, number, bigint, or FinancialAmount into an exact instance.
   */
  public static from(value: string | number | bigint | FinancialAmount): FinancialAmount {
    if (value instanceof FinancialAmount) {
      return value;
    }

    if (typeof value === 'bigint') {
      return new FinancialAmount(value * FinancialAmount.MULTIPLIER);
    }

    let str: string;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`FinancialAmount: Invalid non-finite number: ${value}`);
      }
      str = value.toFixed(8);
    } else if (typeof value === 'string') {
      str = value.trim().replace(/,/g, '');
      if (str === '') {
        throw new Error('FinancialAmount: Cannot parse empty string as financial amount.');
      }
    } else {
      throw new Error(`FinancialAmount: Unsupported type for conversion: ${typeof value}`);
    }

    // Validate decimal pattern
    const regex = /^([+-])?(\d+)(\.(\d+))?$/;
    const match = str.match(regex);
    if (!match) {
      throw new Error(`FinancialAmount: Invalid numeric string: "${value}"`);
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const integerPart = BigInt(match[2]);
    let fractionStr = match[4] || '';

    // Normalize fraction to 4 decimal places
    if (fractionStr.length > FinancialAmount.SCALE) {
      // Check next digit for half-up rounding during parse
      const nextDigit = parseInt(fractionStr[FinancialAmount.SCALE], 10);
      fractionStr = fractionStr.substring(0, FinancialAmount.SCALE);
      let fractionBig = BigInt(fractionStr);
      if (nextDigit >= 5) {
        fractionBig += 1n;
      }
      const rawVal = sign * (integerPart * FinancialAmount.MULTIPLIER + fractionBig);
      return new FinancialAmount(rawVal);
    }

    // Pad right with zeroes up to SCALE
    while (fractionStr.length < FinancialAmount.SCALE) {
      fractionStr += '0';
    }

    const fractionPart = BigInt(fractionStr);
    const rawVal = sign * (integerPart * FinancialAmount.MULTIPLIER + fractionPart);
    return new FinancialAmount(rawVal);
  }

  /**
   * Creates a zero amount: 0.0000
   */
  public static zero(): FinancialAmount {
    return new FinancialAmount(0n);
  }

  /**
   * Addition: exact A + B
   */
  public add(other: string | number | bigint | FinancialAmount): FinancialAmount {
    const o = FinancialAmount.from(other);
    return new FinancialAmount(this.raw + o.raw);
  }

  /**
   * Subtraction: exact A - B
   */
  public subtract(other: string | number | bigint | FinancialAmount): FinancialAmount {
    const o = FinancialAmount.from(other);
    return new FinancialAmount(this.raw - o.raw);
  }

  /**
   * Multiplication: exact (A * B) / 10^SCALE with Half-Up rounding
   */
  public multiply(factor: string | number | bigint | FinancialAmount): FinancialAmount {
    const f = FinancialAmount.from(factor);
    const product = this.raw * f.raw;
    // Divide by MULTIPLIER with half-up rounding on the remainder
    const half = FinancialAmount.MULTIPLIER / 2n;
    const rounded = product >= 0n ? (product + half) / FinancialAmount.MULTIPLIER : (product - half) / FinancialAmount.MULTIPLIER;
    return new FinancialAmount(rounded);
  }

  /**
   * Division: exact (A * 10^SCALE) / B with Half-Up rounding
   */
  public divide(divisor: string | number | bigint | FinancialAmount): FinancialAmount {
    const d = FinancialAmount.from(divisor);
    if (d.raw === 0n) {
      throw new Error('FinancialAmount: Division by zero');
    }
    const numerator = this.raw * FinancialAmount.MULTIPLIER;
    const half = d.raw >= 0n ? d.raw / 2n : (-d.raw) / 2n;
    const rounded = numerator >= 0n
      ? (numerator + half) / d.raw
      : (numerator - half) / d.raw;
    return new FinancialAmount(rounded);
  }

  /**
   * Absolute value
   */
  public abs(): FinancialAmount {
    return this.raw < 0n ? new FinancialAmount(-this.raw) : this;
  }

  /**
   * Negation
   */
  public negate(): FinancialAmount {
    return new FinancialAmount(-this.raw);
  }

  /**
   * Checks if amount is exactly zero (0.00)
   */
  public isZero(): boolean {
    return this.raw === 0n;
  }

  /**
   * Checks if amount is strictly positive (> 0.00)
   */
  public isPositive(): boolean {
    return this.raw > 0n;
  }

  /**
   * Checks if amount is strictly negative (< 0.00)
   */
  public isNegative(): boolean {
    return this.raw < 0n;
  }

  /**
   * Equality check
   */
  public equals(other: string | number | bigint | FinancialAmount): boolean {
    const o = FinancialAmount.from(other);
    return this.raw === o.raw;
  }

  /**
   * Comparison: returns -1 if this < other, 0 if equal, 1 if this > other
   */
  public compareTo(other: string | number | bigint | FinancialAmount): -1 | 0 | 1 {
    const o = FinancialAmount.from(other);
    if (this.raw < o.raw) return -1;
    if (this.raw > o.raw) return 1;
    return 0;
  }

  /**
   * Round to target decimal scale using specified rounding rule (default 2 decimals, ROUND_HALF_UP)
   */
  public round(targetScale = 2, mode: RoundingMode = 'ROUND_HALF_UP'): FinancialAmount {
    if (targetScale < 0 || targetScale > FinancialAmount.SCALE) {
      throw new Error(`FinancialAmount: Round target scale must be between 0 and ${FinancialAmount.SCALE}`);
    }

    if (targetScale === FinancialAmount.SCALE) {
      return this;
    }

    const factor = 10n ** BigInt(FinancialAmount.SCALE - targetScale);
    const sign = this.raw < 0n ? -1n : 1n;
    const absVal = this.raw < 0n ? -this.raw : this.raw;

    const integerChunk = absVal / factor;
    const remainder = absVal % factor;

    let roundedAbs = integerChunk;

    if (remainder !== 0n) {
      const half = factor / 2n;

      switch (mode) {
        case 'ROUND_HALF_UP':
          if (remainder >= half) {
            roundedAbs += 1n;
          }
          break;
        case 'ROUND_HALF_EVEN': // Banker's Rounding
          if (remainder > half) {
            roundedAbs += 1n;
          } else if (remainder === half) {
            // Round to nearest even
            if (integerChunk % 2n !== 0n) {
              roundedAbs += 1n;
            }
          }
          break;
        case 'ROUND_CEIL':
          if (sign > 0n) roundedAbs += 1n;
          break;
        case 'ROUND_FLOOR':
          if (sign < 0n) roundedAbs += 1n;
          break;
      }
    }

    const newRaw = sign * (roundedAbs * factor);
    return new FinancialAmount(newRaw);
  }

  /**
   * Formats as fixed decimal string (e.g. "1250.50")
   */
  public toString(scale = 2): string {
    const rounded = this.round(scale, 'ROUND_HALF_UP');
    const sign = rounded.raw < 0n ? '-' : '';
    const absVal = rounded.raw < 0n ? -rounded.raw : rounded.raw;

    const intPart = absVal / FinancialAmount.MULTIPLIER;
    const fracPart = absVal % FinancialAmount.MULTIPLIER;

    if (scale === 0) {
      return `${sign}${intPart.toString()}`;
    }

    // Convert fraction to string padded to SCALE
    let fracStr = fracPart.toString().padStart(FinancialAmount.SCALE, '0');
    // Slice to target scale
    fracStr = fracStr.substring(0, scale);

    return `${sign}${intPart.toString()}.${fracStr}`;
  }

  /**
   * Alias for toString(2)
   */
  public toFixed(scale = 2): string {
    return this.toString(scale);
  }

  /**
   * Converts to JS number (Note: strictly for display/JSON serialization)
   */
  public toNumber(): number {
    return parseFloat(this.toString(2));
  }

  /**
   * Formatted string with currency symbol and locale separators
   */
  public toFormatted(currencyCode = 'INR'): string {
    const num = this.toNumber();
    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    const symbol = currencyCode === 'INR' ? '₹' : currencyCode === 'USD' ? '$' : currencyCode === 'EUR' ? '€' : currencyCode;
    return `${symbol} ${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
