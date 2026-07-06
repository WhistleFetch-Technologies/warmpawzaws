/**
 * Local policy simulator — dry-run when backend simulate API is unavailable.
 * Uses business rules + simplified discount math (no full resolver).
 */
import { ensureBusinessRules, getWinningStrategyLabel } from './business-rules-mapper';
import type { WinningStrategyKey } from './business-rules-types';
import { WINNING_TO_PRIORITY } from './business-rules-types';
import type { DiscountPolicyBundle } from './types';

export interface SimulatorOfferInput {
  offerType: string;
  enabled: boolean;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  priorityWeight?: number;
  platformCostPercent?: number;
}

export interface PolicySimulationInput {
  servicePrice: number;
  domain?: string;
  offers: SimulatorOfferInput[];
}

export interface SimulatedOffer {
  offerType: string;
  label: string;
  discountAmount: number;
  eligible: boolean;
}

export interface PolicySimulationResult {
  mode: 'local';
  applicationStrategy: string;
  winningStrategy: string | null;
  eligibleOffers: SimulatedOffer[];
  winningOffer: SimulatedOffer | null;
  ignoredOffers: SimulatedOffer[];
  reason: string;
  customerPays: number;
  totalSavings: number;
  vendorFunds: number;
  platformFunds: number;
  settlementPreview: string;
  appliedOffers: SimulatedOffer[];
}

const OFFER_LABELS: Record<string, string> = {
  VENDOR_PROMOTION: 'Vendor Promotion',
  PLATFORM_PROMOTION: 'Platform Promotion',
  VENDOR_COUPON: 'Vendor Coupon',
  PLATFORM_COUPON: 'Platform Coupon',
};

function calcDiscount(price: number, offer: SimulatorOfferInput): number {
  if (!offer.enabled || offer.value <= 0) return 0;
  if (offer.discountType === 'PERCENT') {
    return Math.round(price * (offer.value / 100) * 100) / 100;
  }
  return Math.min(offer.value, price);
}

function funderForType(offerType: string): 'VENDOR' | 'PLATFORM' {
  if (offerType.startsWith('VENDOR')) return 'VENDOR';
  if (offerType.startsWith('PLATFORM')) return 'PLATFORM';
  return 'PLATFORM';
}

function pickWinner(
  eligible: SimulatedOffer[],
  inputs: SimulatorOfferInput[],
  winningStrategy: WinningStrategyKey,
  customOrder: string[]
): SimulatedOffer {
  if (eligible.length === 1) return eligible[0];

  switch (winningStrategy) {
    case 'MAX_CUSTOMER_SAVINGS':
      return [...eligible].sort((a, b) => b.discountAmount - a.discountAmount)[0];
    case 'LOWEST_PLATFORM_COST': {
      const platformCost = (o: SimulatedOffer) => {
        const input = inputs.find((i) => i.offerType === o.offerType);
        const pct = input?.platformCostPercent ?? (funderForType(o.offerType) === 'PLATFORM' ? 100 : 0);
        return o.discountAmount * (pct / 100);
      };
      return [...eligible].sort((a, b) => platformCost(a) - platformCost(b))[0];
    }
    case 'HIGHEST_PRIORITY': {
      const weight = (o: SimulatedOffer) =>
        inputs.find((i) => i.offerType === o.offerType)?.priorityWeight ?? 0;
      return [...eligible].sort((a, b) => weight(b) - weight(a))[0];
    }
    case 'VENDOR_PREFERRED': {
      const vendorFirst = (o: SimulatedOffer) => (funderForType(o.offerType) === 'VENDOR' ? 1 : 0);
      return [...eligible].sort((a, b) => {
        const vf = vendorFirst(b) - vendorFirst(a);
        if (vf !== 0) return vf;
        return b.discountAmount - a.discountAmount;
      })[0];
    }
    case 'CUSTOM_PRIORITY': {
      const rank = (o: SimulatedOffer) => {
        const idx = customOrder.indexOf(o.offerType);
        return idx === -1 ? 999 : idx;
      };
      return [...eligible].sort((a, b) => rank(a) - rank(b))[0];
    }
    default:
      return eligible[0];
  }
}

function stackSequential(
  price: number,
  eligible: SimulatedOffer[],
  matrixAllowed: (a: string, b: string) => boolean,
  stackOrder: string[]
): SimulatedOffer[] {
  const sorted = [...eligible].sort(
    (a, b) => stackOrder.indexOf(a.offerType) - stackOrder.indexOf(b.offerType)
  );
  const applied: SimulatedOffer[] = [];
  let running = price;

  for (const offer of sorted) {
    if (applied.some((a) => !matrixAllowed(a.offerType, offer.offerType))) continue;
    const input = offer;
    const amt = Math.min(input.discountAmount, running);
    if (amt <= 0) continue;
    applied.push({ ...input, discountAmount: amt });
    running -= amt;
    if (running <= 0) break;
  }

  return applied;
}

export function simulatePolicyLocally(
  bundle: DiscountPolicyBundle,
  input: PolicySimulationInput
): PolicySimulationResult {
  const rules = ensureBusinessRules(bundle);
  const price = Math.max(0, input.servicePrice);

  const simulated: SimulatedOffer[] = input.offers.map((o) => ({
    offerType: o.offerType,
    label: OFFER_LABELS[o.offerType] ?? o.offerType,
    discountAmount: calcDiscount(price, o),
    eligible: o.enabled && calcDiscount(price, o) > 0,
  }));

  const eligible = simulated.filter((s) => s.eligible);
  const matrixAllowed = (a: string, b: string) => {
    const id = [a, b].sort().join('::');
    const rule = rules.combinationMatrix.find((r) => r.id === id);
    return rule?.allowed ?? false;
  };

  let applied: SimulatedOffer[] = [];
  let winning: SimulatedOffer | null = null;
  let reason = '';

  if (rules.applicationStrategy === 'BEST_OFFER_ONLY') {
    const winningKey = rules.winningStrategy ?? 'MAX_CUSTOMER_SAVINGS';
    winning = eligible.length ? pickWinner(eligible, input.offers, winningKey, rules.customPriorityOrder) : null;
    applied = winning ? [winning] : [];
    reason = winning
      ? `${getWinningStrategyLabel(winningKey)} (${WINNING_TO_PRIORITY[winningKey]})`
      : 'No eligible offers';
  } else if (rules.applicationStrategy === 'STACK_ELIGIBLE') {
    applied = stackSequential(price, eligible, matrixAllowed, rules.customPriorityOrder);
    winning = applied[0] ?? null;
    reason = applied.length
      ? `Stacked ${applied.length} offer(s) per Offer Combination Rules`
      : 'No stackable offers for configured combinations';
  } else {
    applied = eligible.slice(0, 1);
    winning = applied[0] ?? null;
    reason = 'Custom Rules — simplified preview (first eligible offer)';
  }

  const ignored = eligible.filter((e) => !applied.some((a) => a.offerType === e.offerType));
  const totalSavings = applied.reduce((s, o) => s + o.discountAmount, 0);

  let vendorFunds = 0;
  let platformFunds = 0;
  for (const o of applied) {
    const funder = funderForType(o.offerType);
    if (funder === 'VENDOR') vendorFunds += o.discountAmount;
    else platformFunds += o.discountAmount;
  }

  return {
    mode: 'local',
    applicationStrategy: rules.applicationStrategy,
    winningStrategy: rules.winningStrategy
      ? getWinningStrategyLabel(rules.winningStrategy)
      : null,
    eligibleOffers: eligible,
    winningOffer: winning,
    ignoredOffers: ignored,
    reason,
    customerPays: Math.max(0, price - totalSavings),
    totalSavings,
    vendorFunds,
    platformFunds,
    settlementPreview: 'Settlement preview unavailable — requires backend resolver.',
    appliedOffers: applied,
  };
}

export const DEFAULT_SIMULATOR_OFFERS: SimulatorOfferInput[] = [
  { offerType: 'VENDOR_PROMOTION', enabled: true, discountType: 'PERCENT', value: 25, priorityWeight: 80 },
  { offerType: 'PLATFORM_PROMOTION', enabled: true, discountType: 'PERCENT', value: 20, priorityWeight: 60 },
  { offerType: 'VENDOR_COUPON', enabled: true, discountType: 'FIXED', value: 100, priorityWeight: 50 },
  { offerType: 'PLATFORM_COUPON', enabled: true, discountType: 'FIXED', value: 200, priorityWeight: 40 },
];

export const DEFAULT_SIMULATOR_SCENARIO = {
  servicePrice: 1000,
  offers: DEFAULT_SIMULATOR_OFFERS,
};
