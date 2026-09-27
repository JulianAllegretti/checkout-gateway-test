import { decimalToNumber } from './decimal';

describe('decimalToNumber', () => {
  it('passes through a plain number', () => {
    expect(decimalToNumber(0.19)).toBe(0.19);
  });

  it('parses a numeric string', () => {
    expect(decimalToNumber('0.19')).toBe(0.19);
  });

  it('calls toNumber() on a Decimal-like object', () => {
    const decimalish = { toNumber: () => 0.19 };
    expect(decimalToNumber(decimalish)).toBe(0.19);
  });

  it('throws for a value it cannot convert', () => {
    expect(() => decimalToNumber(null as unknown as number)).toThrow(/Cannot convert/);
  });
});
