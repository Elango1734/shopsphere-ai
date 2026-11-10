import type { Money } from '@shopsphere/shared-types';

/** Money is always integer minor units + an ISO 4217 code (never a float) — see docs/api-specification.md. */
export function formatMoney(money: Money | null | undefined, locale = 'en-US'): string {
  if (!money) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency }).format(money.amountMinor / 100);
}

export function formatMinor(amountMinor: number, currency: string, locale = 'en-US'): string {
  return formatMoney({ amountMinor, currency }, locale);
}
