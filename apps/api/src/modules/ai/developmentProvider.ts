const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'with', 'under', 'over', 'me', 'i', 'want', 'need', 'looking', 'show', 'find',
  'some', 'please', 'to', 'buy', 'get', 'is', 'are', 'of', 'in', 'on', 'that', 'this'
]);

export interface ExtractedIntent {
  keywords: string[];
  maxPriceMinor?: number;
}

/**
 * The "AI provider" implemented in this stage: deterministic keyword/budget
 * extraction, never a generative model — there is no `AI_API_KEY` configured
 * (blocked per docs/task-checklist.md, "Live provider credentials/policy
 * corpus required"). It is incapable of inventing a price, product, or stock
 * status because it never generates catalog facts itself; it only derives a
 * search query from the user's message and lets the real catalog repository
 * answer. This satisfies the grounding requirement by construction rather
 * than by output-validation, and is clearly labeled as the limitation it is
 * — see README's known limitations and security.md's AI boundary.
 */
export function extractIntent(message: string): ExtractedIntent {
  const priceMatch = message.match(/\$?\s?(\d{1,6})(?:\s?(?:dollars|usd))?/i);
  const maxPriceMinor = priceMatch?.[1] ? Number(priceMatch[1]) * 100 : undefined;

  const keywords = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word));

  return { keywords: [...new Set(keywords)].slice(0, 8), ...(maxPriceMinor ? { maxPriceMinor } : {}) };
}

const FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['return', 'refund'],
    answer:
      'Most items can be returned within the product-specific return window shown on its page. Once a return is approved, refunds are issued to your original payment method and tracked under your return request.'
  },
  {
    keywords: ['shipping', 'delivery', 'deliver'],
    answer: 'Shipping cost and estimated delivery are shown at checkout based on your address and cart total.'
  },
  {
    keywords: ['cancel'],
    answer: 'You can cancel an order from your order history while it is still pending or confirmed, before it ships.'
  },
  {
    keywords: ['account', 'password', 'login'],
    answer: 'You can update your password and profile details from your account settings.'
  }
];

export function matchFaq(message: string): string | null {
  const lower = message.toLowerCase();
  const match = FAQ.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  return match?.answer ?? null;
}
