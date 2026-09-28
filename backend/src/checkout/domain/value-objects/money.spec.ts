import { Money } from './money';

describe('Money', () => {
  describe('of', () => {
    it('creates a valid amount', () => {
      const money = Money.of(350000, 'COP');
      expect(money.amount).toBe(350000);
      expect(money.currency).toBe('COP');
    });

    it('rejects non-integer amounts', () => {
      expect(() => Money.of(100.5, 'COP')).toThrow(/integer/);
    });

    it('rejects negative amounts', () => {
      expect(() => Money.of(-1, 'COP')).toThrow(/negative/);
    });

    it('allows zero', () => {
      expect(() => Money.of(0, 'COP')).not.toThrow();
    });
  });

  describe('add', () => {
    it('sums amounts in the same currency', () => {
      const total = Money.of(350000, 'COP').add(Money.of(5000, 'COP'));
      expect(total.amount).toBe(355000);
    });

    it('rejects mixing currencies', () => {
      expect(() => Money.of(1, 'COP').add(Money.of(1, 'USD'))).toThrow(/Currency mismatch/);
    });
  });

  describe('multiply', () => {
    it('multiplies and rounds to the nearest integer', () => {
      const tax = Money.of(350000, 'COP').multiply(0.19);
      expect(tax.amount).toBe(66500);
    });

    it('rounds half up', () => {
      expect(Money.of(3, 'COP').multiply(0.5).amount).toBe(2);
    });
  });

  describe('equals', () => {
    it('is true for same amount and currency', () => {
      expect(Money.of(100, 'COP').equals(Money.of(100, 'COP'))).toBe(true);
    });

    it('is false for different amounts', () => {
      expect(Money.of(100, 'COP').equals(Money.of(200, 'COP'))).toBe(false);
    });

    it('is false for different currencies', () => {
      expect(Money.of(100, 'COP').equals(Money.of(100, 'USD'))).toBe(false);
    });
  });
});
