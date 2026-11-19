import type { Quote } from './types';

export type Verdict = 'best_value' | 'cheapest' | 'outlier' | 'standard';

export interface RankedQuote extends Quote {
  mid: number;
  effectiveCost: number;
  isOutlier: boolean;
  verdict: Verdict;
}

export function midPrice(quote: Quote): number {
  return (quote.priceBand[0] + quote.priceBand[1]) / 2;
}

export function riskPremium(mid: number, warrantyMonths: number): number {
  const missingYears = 12 - Math.min(warrantyMonths, 12);
  return mid * ((0.06 * missingYears) / 12);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function rank(quotes: Quote[]): RankedQuote[] {
  if (quotes.length === 0) return [];

  const mids = quotes.map(midPrice);
  const medianMid = median(mids);
  const cheapestMid = Math.min(...mids);

  const computed = quotes.map((quote) => {
    const mid = midPrice(quote);
    return {
      ...quote,
      mid,
      effectiveCost: mid + riskPremium(mid, quote.warrantyMonths),
      isOutlier: mid > 1.6 * medianMid,
      verdict: 'standard' as Verdict,
    };
  });

  computed.sort((a, b) => a.effectiveCost - b.effectiveCost || a.mid - b.mid);

  const bestValue = computed.find((quote) => !quote.isOutlier);
  const cheapest = computed.find((quote) => !quote.isOutlier && quote.mid === cheapestMid);

  return computed.map((quote) => {
    if (quote.isOutlier) return { ...quote, verdict: 'outlier' };
    if (bestValue && quote.workshopId === bestValue.workshopId) return { ...quote, verdict: 'best_value' };
    if (cheapest && quote.workshopId === cheapest.workshopId) return { ...quote, verdict: 'cheapest' };
    return { ...quote, verdict: 'standard' };
  });
}
