import type { FallbackReason, Letter, RankedPromo, RankingOverride } from './types';

const LETTER_RANK: Record<Letter, number> = { V: 3, C: 2, F: 1 };

function bySpecificityThenPriority(a: RankedPromo, b: RankedPromo): number {
  const letter = LETTER_RANK[b.publishLetter] - LETTER_RANK[a.publishLetter];
  if (letter !== 0) return letter;
  const pri = (b.priority || 0) - (a.priority || 0);
  if (pri !== 0) return pri;
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
}

function byOverride(strategy: RankingOverride, a: RankedPromo, b: RankedPromo): number {
  if (strategy === 'least_platform_loss') {
    return (a.discount || 0) - (b.discount || 0);
  }
  if (strategy === 'max_customer_discount') {
    return (b.discount || 0) - (a.discount || 0);
  }
  if (strategy === 'max_customer_cashback') {
    return (b.cashback || 0) - (a.cashback || 0);
  }
  return (b.discount || 0) + (b.cashback || 0) - ((a.discount || 0) + (a.cashback || 0));
}

function fallbackReason(winner: RankedPromo, loser: RankedPromo): FallbackReason {
  if (LETTER_RANK[winner.publishLetter] > LETTER_RANK[loser.publishLetter]) {
    return 'LOST_TO_MORE_SPECIFIC';
  }
  return 'LOST_TO_PRIORITY';
}

/**
 * Score all eligible, then pick. Does not short-circuit.
 * Default: publish V > C > F, then priority, then later updated_at.
 * Override runs only if set on the specificity winner; re-sorts that eligible set only.
 */
export function rankEligible(eligible: RankedPromo[]): {
  winner: RankedPromo | null;
  fallbacks: Array<{ promotionId: string; reason: FallbackReason }>;
} {
  if (!eligible.length) return { winner: null, fallbacks: [] };

  const specificityOrder = [...eligible].sort(bySpecificityThenPriority);
  const specificityWinner = specificityOrder[0];
  const override = specificityWinner.rankingOverride;
  const ordered = override
    ? [...eligible].sort((a, b) => {
        const by = byOverride(override, a, b);
        return by !== 0 ? by : bySpecificityThenPriority(a, b);
      })
    : specificityOrder;

  const winner = ordered[0];
  const fallbacks = ordered.slice(1).map((row) => ({
    promotionId: row.promotionId,
    reason: fallbackReason(winner, row),
  }));
  return { winner, fallbacks };
}
