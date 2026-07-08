import type { CommercialAiModule } from './types';

const BY_MODULE: Record<CommercialAiModule, string[]> = {
  promotions: [
    'Explain this promotion',
    "Why isn't this promotion active?",
    'Explain eligibility for this promotion',
    'How does funding work for this offer?',
  ],
  coupons: [
    'Explain this coupon',
    "Why didn't this coupon apply?",
    'Explain coupon eligibility',
    'Explain redemption limits',
  ],
  policy: [
    'Explain Best Offer Only',
    'Explain Winning Strategy',
    'Explain Stack Rules',
    'Explain Runtime Policy vs Draft',
  ],
  campaigns: [
    'Explain Campaign Health',
    'Explain Funding for this campaign',
    'Explain Budget for this campaign',
    'Why are linked offers inactive?',
  ],
  analytics: [
    'Explain ROI',
    'Explain Redemption Rate',
    'Explain discount spend vs revenue',
  ],
  settlement: [
    'Explain Settlement attribution',
    'Why did the vendor receive this amount?',
    'Explain platform vs vendor funding share',
  ],
  finance: [
    'Explain platform finance summary',
    'Explain settlement payouts',
  ],
  notifications: [
    'Explain campaign notification linkage',
    'Explain vendor enrollment notifications',
  ],
  other: [
    'What is the Commercial Platform?',
    'Explain SERVICE vs ECOMMERCE domain',
  ],
};

export function suggestedQuestionsForModule(module: CommercialAiModule, entityName?: string): string[] {
  const base = BY_MODULE[module] ?? BY_MODULE.other;
  if (!entityName) return base.slice(0, 5);
  return base.map((q) => q.replace('this', `"${entityName}"`)).slice(0, 5);
}
