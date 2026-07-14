import type { RuleGroup } from './types';
import { getRuleRegistry } from './registry';

export const RULE_GROUP_ORDER = ['general', 'customer', 'domain', 'promotion'] as const;

export type RuleGroupName = (typeof RULE_GROUP_ORDER)[number];

export function getRuleGroupsForDomain(
  domain: Parameters<ReturnType<typeof getRuleRegistry>['getForDomain']>[0]
): RuleGroup[] {
  const rules = getRuleRegistry().getForDomain(domain);
  const byGroup = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = byGroup.get(rule.group) ?? [];
    list.push(rule);
    byGroup.set(rule.group, list);
  }
  return RULE_GROUP_ORDER.filter((name) => byGroup.has(name)).map((name) => ({
    name,
    rules: byGroup.get(name) ?? [],
  }));
}
