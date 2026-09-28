interface Decimalish {
  toNumber(): number;
}

function isDecimalish(value: unknown): value is Decimalish {
  return typeof value === 'object' && value !== null && typeof (value as Decimalish).toNumber === 'function';
}

/** Prisma's `@db.Decimal` fields come back as Decimal.js instances, not plain numbers. */
export function decimalToNumber(value: number | string | Decimalish): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (isDecimalish(value)) return value.toNumber();
  throw new Error(`Cannot convert value to number: ${String(value)}`);
}
