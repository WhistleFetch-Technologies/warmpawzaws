import type { PriceBreakdownLine } from './types';
import type { MealTrackingSummaryLine } from '@/lib/meal-order-tracking-details';
import { roundMoney } from './format';

/** Map meal tracking summary lines to unified PriceBreakdownLine[] for PriceBreakdown. */
export function mapMealSummaryToPriceLines(
  lines: MealTrackingSummaryLine[],
  total: number
): PriceBreakdownLine[] {
  const result: PriceBreakdownLine[] = lines
    .filter((line) => line.showZero || line.amount > 0 || line.label.startsWith('GST'))
    .map((line, idx) => ({
      id: `meal-${idx}`,
      kind: line.label.toLowerCase().includes('gst')
        ? ('tax' as const)
        : line.label.toLowerCase().includes('delivery')
          ? ('delivery_fee' as const)
          : line.label.toLowerCase().includes('platform')
            ? ('platform_fee' as const)
            : line.label.toLowerCase().includes('convenience')
              ? ('convenience_fee' as const)
              : ('base' as const),
      label: line.sublabel ? `${line.label} (${line.sublabel})` : line.label,
      amount: roundMoney(line.amount),
      emphasis: 'default' as const,
    }));

  result.push({
    id: 'meal-final',
    kind: 'final',
    label: 'Total paid',
    amount: roundMoney(total),
    emphasis: 'total',
  });

  return result;
}
