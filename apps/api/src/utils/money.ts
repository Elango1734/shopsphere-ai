import type { Money } from '@shopsphere/shared-types';

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function isNonNegative(money: Money): boolean {
  return money.amountMinor >= 0;
}

export function zeroMoney(currency: string): Money {
  return { amountMinor: 0, currency };
}

export function sumMoney(items: Money[], currency: string): Money {
  return items.reduce((acc, item) => addMoney(acc, item), zeroMoney(currency));
}
