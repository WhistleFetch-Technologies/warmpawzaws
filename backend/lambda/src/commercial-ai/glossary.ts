/** Commercial glossary — single source of truth for tooltips + Explain pipeline. */

export interface CommercialGlossaryEntry {
  id: string;
  term: string;
  short: string;
  example?: string;
  learnMore?: string;
  modules: string[];
}

export const COMMERCIAL_GLOSSARY: CommercialGlossaryEntry[] = [
  {
    id: 'funding',
    term: 'Funding',
    short: 'Who pays the discount: Platform, Vendor, or Shared split between platform and vendor.',
    example: 'A 50/50 Shared campaign splits discount cost equally.',
    learnMore: 'Funding is configured on campaigns and inherited by linked promotions when orchestrated.',
    modules: ['campaigns', 'policy', 'promotions'],
  },
  {
    id: 'winning_strategy',
    term: 'Winning Strategy / Best Offer',
    short: 'Policy Center rule for which promotion wins when multiple offers apply at checkout.',
    example: 'Best Offer Only keeps the single highest customer savings.',
    modules: ['policy'],
  },
  {
    id: 'stack_rules',
    term: 'Stack Rules',
    short: 'Whether multiple promotions or coupons can combine on one order.',
    modules: ['policy', 'coupons', 'promotions'],
  },
  {
    id: 'campaign_health',
    term: 'Campaign Health',
    short: 'Healthy, Warning, or Critical — based on budget, schedule, linked offers, policy, and state.',
    example: 'Critical when budget is exhausted or no linked offers exist before publish.',
    modules: ['campaigns'],
  },
  {
    id: 'campaign_vs_promotion',
    term: 'Campaign vs Promotion',
    short: 'Campaigns orchestrate offers, funding, and schedule. Promotions/coupons still price discounts via the Discount Engine.',
    modules: ['campaigns', 'promotions'],
  },
  {
    id: 'discount_domain',
    term: 'Discount Domain',
    short: 'SERVICE (bookings) or ECOMMERCE (shop). Offers must not mix domains in one campaign.',
    modules: ['promotions', 'coupons', 'campaigns', 'policy'],
  },
  {
    id: 'roi',
    term: 'ROI',
    short: 'Return on investment from campaign or promotion analytics — revenue vs discount spend.',
    modules: ['analytics', 'campaigns'],
  },
  {
    id: 'redemption',
    term: 'Redemption',
    short: 'Count of times a coupon or promotion was successfully applied to an order or booking.',
    modules: ['analytics', 'coupons', 'promotions'],
  },
  {
    id: 'settlement_attribution',
    term: 'Settlement Attribution',
    short: 'How discount funding splits appear in vendor payout calculations after a completed order.',
    modules: ['settlement', 'campaigns', 'finance'],
  },
  {
    id: 'runtime_policy',
    term: 'Runtime Policy',
    short: 'Published Policy Center settings actively used by the Discount Resolver at checkout.',
    modules: ['policy'],
  },
  {
    id: 'budget_cap',
    term: 'Budget Cap',
    short: 'Maximum discount spend for a campaign. When exhausted, running campaigns may auto-pause.',
    modules: ['campaigns'],
  },
];

export function findGlossaryEntry(idOrTerm: string): CommercialGlossaryEntry | undefined {
  const q = idOrTerm.toLowerCase();
  return COMMERCIAL_GLOSSARY.find(
    (e) => e.id === q || e.term.toLowerCase().includes(q)
  );
}

export function glossaryForModule(module: string): CommercialGlossaryEntry[] {
  const m = module.toLowerCase();
  return COMMERCIAL_GLOSSARY.filter((e) => e.modules.includes(m) || e.modules.includes('other'));
}
