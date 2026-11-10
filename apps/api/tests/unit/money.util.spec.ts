import { describe, it, expect } from '@jest/globals';
import { addMoney, subtractMoney, sumMoney, zeroMoney, CurrencyMismatchError } from '../../src/utils/money.js';

describe('money utils', () => {
  it('adds two amounts in the same currency', () => {
    expect(addMoney({ amountMinor: 100, currency: 'USD' }, { amountMinor: 250, currency: 'USD' })).toEqual({
      amountMinor: 350,
      currency: 'USD'
    });
  });

  it('subtracts amounts in the same currency', () => {
    expect(subtractMoney({ amountMinor: 500, currency: 'USD' }, { amountMinor: 200, currency: 'USD' })).toEqual({
      amountMinor: 300,
      currency: 'USD'
    });
  });

  it('throws on currency mismatch', () => {
    expect(() => addMoney({ amountMinor: 100, currency: 'USD' }, { amountMinor: 100, currency: 'EUR' })).toThrow(
      CurrencyMismatchError
    );
  });

  it('sums a list of money values against a base currency', () => {
    const total = sumMoney(
      [
        { amountMinor: 100, currency: 'USD' },
        { amountMinor: 250, currency: 'USD' }
      ],
      'USD'
    );
    expect(total).toEqual({ amountMinor: 350, currency: 'USD' });
  });

  it('zeroMoney starts from zero in the given currency', () => {
    expect(zeroMoney('USD')).toEqual({ amountMinor: 0, currency: 'USD' });
  });
});
