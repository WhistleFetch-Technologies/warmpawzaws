/** Metadata relationships for explanations — no duplicate business logic. */

export const COMMERCIAL_KNOWLEDGE_GRAPH = {
  promotion: {
    relatesTo: ['campaign', 'policy', 'settlement', 'analytics'],
    description: 'A promotion applies a discount rule to targeted services or products.',
  },
  coupon: {
    relatesTo: ['campaign', 'policy', 'settlement', 'analytics'],
    description: 'A coupon is a code-based discount with eligibility rules.',
  },
  campaign: {
    relatesTo: ['promotion', 'coupon', 'policy', 'funding', 'settlement', 'analytics', 'notification'],
    description: 'A campaign orchestrates linked offers, funding, schedule, and notifications.',
  },
  policy: {
    relatesTo: ['promotion', 'coupon', 'campaign', 'resolver'],
    description: 'Published Policy Center settings constrain stacking, winning strategy, and funding defaults.',
  },
  funding: {
    relatesTo: ['campaign', 'settlement', 'policy'],
    description: 'Funding defines platform vs vendor share of discount cost.',
  },
  settlement: {
    relatesTo: ['funding', 'campaign', 'promotion', 'coupon', 'finance'],
    description: 'Settlement attributes discount cost to parties after order completion.',
  },
  analytics: {
    relatesTo: ['promotion', 'coupon', 'campaign'],
    description: 'Analytics aggregates redemptions, spend, and ROI from linked offers.',
  },
  notification: {
    relatesTo: ['campaign'],
    description: 'Commercial campaigns may link to notification campaigns for customer or vendor alerts.',
  },
} as const;

export function knowledgeGraphSummary(focus?: string): string {
  if (!focus) {
    return Object.entries(COMMERCIAL_KNOWLEDGE_GRAPH)
      .map(([k, v]) => `${k} → ${v.relatesTo.join(', ')}`)
      .join('\n');
  }
  const key = focus.toLowerCase().replace(/s$/, '');
  const node = (COMMERCIAL_KNOWLEDGE_GRAPH as Record<string, { relatesTo: readonly string[]; description: string }>)[key];
  if (!node) return '';
  return `${focus}: ${node.description}\nRelated: ${node.relatesTo.join(', ')}`;
}
