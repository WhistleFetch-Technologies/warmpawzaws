/**
 * ============================================================================
 * RULE ENGINE – Discovery & Service Rules
 * ============================================================================
 * Merges platform defaults with DB discovery_rules. Used by discovery APIs,
 * meal search, pharmacy broadcast, chat/follow-up/review/booking flows.
 * See: docs/RULE_ENGINE_DISCOVERY_AND_SERVICES_PROPOSAL.md
 * ============================================================================
 */

import { query } from '../database/rds-connection';

export type DiscoveryRuleSet = {
  discovery_radius_km?: number;
  discovery_max_results?: number;
  discovery_sort_default?: string;
  discovery_location_source?: string;
  hyperlocal_max_distance_km?: number;
  order_accept_max_distance_km?: number;
  broadcast_radius_km_initial?: number;
  broadcast_radius_km_steps?: number[];
  follow_up_days?: number;
  chat_available_days_post_appointment?: number;
  chat_available_before_appointment_minutes?: number;
  review_eligible_days?: number;
  booking_min_notice_hours?: number;
  appointment_reminder_minutes_before?: number;
  video_call_grace_period_minutes?: number;
  cancellation_cutoff_hours?: number;
  [key: string]: number | string | number[] | undefined;
};

/** Platform defaults (fallback when DB has no override). */
const PLATFORM_DEFAULTS: DiscoveryRuleSet = {
  discovery_radius_km: 50,
  discovery_max_results: 50,
  discovery_sort_default: 'relevance',
  discovery_location_source: 'mobile_then_base',
  hyperlocal_max_distance_km: 10,
  order_accept_max_distance_km: 15,
  broadcast_radius_km_initial: 5,
  broadcast_radius_km_steps: [5, 10, 20],
  follow_up_days: 7,
  chat_available_days_post_appointment: 7,
  chat_available_before_appointment_minutes: 5,
  review_eligible_days: 7,
  booking_min_notice_hours: 1,
  appointment_reminder_minutes_before: 5,
  video_call_grace_period_minutes: 5,
  cancellation_cutoff_hours: 12,
};

/** Normalize rule_key from DB (e.g. discovery_radius_km) to camel/snake as used in code. */
function ruleKeyToProp(key: string): string {
  return key;
}

/** Extract value from rule_value JSONB. Supports { value: N }, { value: "x" }, { value: [5,10,20] }. */
function extractRuleValue(ruleValue: any): number | string | number[] | undefined {
  if (ruleValue == null) return undefined;
  if (typeof ruleValue === 'object' && 'value' in ruleValue) {
    const v = ruleValue.value;
    if (Array.isArray(v)) return v as number[];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return v;
    return undefined;
  }
  if (typeof ruleValue === 'number') return ruleValue;
  if (typeof ruleValue === 'string') return ruleValue;
  if (Array.isArray(ruleValue)) return ruleValue as number[];
  return undefined;
}

/**
 * Get merged discovery/operation rules for a role, flow, and optional service style/type.
 * Resolution (later rows override): platform defaults → role 'all' no style/type →
 * role 'all' + style (+ type) → specific role no style/type → specific role + style (+ type).
 */
export async function getDiscoveryRules(
  roleId: string,
  flow?: string,
  serviceStyle?: string | null,
  serviceType?: string | null
): Promise<DiscoveryRuleSet> {
  const result: DiscoveryRuleSet = { ...PLATFORM_DEFAULTS };
  const style = (serviceStyle && serviceStyle.trim()) || '';
  const type = (serviceType && serviceType.trim()) || '';

  try {
    const res = await query(
      `SELECT rule_key, rule_value FROM discovery_rules
       WHERE is_active = true
         AND (role_id = 'all' OR role_id = $1)
         AND (COALESCE(applies_to_flow, '') = '' OR applies_to_flow = $2)
         AND (COALESCE(service_style, '') = '' OR COALESCE(service_style, '') = COALESCE($3, ''))
         AND (COALESCE(service_type, '') = '' OR COALESCE(service_type, '') = COALESCE($4, ''))
       ORDER BY
         CASE WHEN role_id = 'all' THEN 0 ELSE 1 END,
         CASE WHEN COALESCE(service_style, '') = '' THEN 0 ELSE 1 END,
         CASE WHEN COALESCE(service_type, '') = '' THEN 0 ELSE 1 END`,
      [roleId, flow || '', style, type]
    );

    for (const row of res.rows as Array<{ rule_key: string; rule_value: any }>) {
      const key = row.rule_key;
      const val = extractRuleValue(row.rule_value);
      if (val !== undefined) (result as any)[key] = val;
    }
  } catch (e) {
    console.warn('[rule-engine] getDiscoveryRules failed, using platform defaults:', e);
  }

  return result;
}

/**
 * Get a single rule value (number) with fallback. Convenience for callers.
 */
export async function getRuleNumber(
  roleId: string,
  ruleKey: keyof DiscoveryRuleSet,
  flow?: string,
  serviceStyle?: string | null,
  serviceType?: string | null
): Promise<number> {
  const rules = await getDiscoveryRules(roleId, flow, serviceStyle, serviceType);
  const v = rules[ruleKey];
  if (typeof v === 'number') return v;
  const def = PLATFORM_DEFAULTS[ruleKey];
  return typeof def === 'number' ? def : 0;
}

/**
 * Get a single rule value (number array) with fallback. E.g. broadcast_radius_km_steps.
 */
export async function getRuleNumberArray(
  roleId: string,
  ruleKey: 'broadcast_radius_km_steps',
  flow?: string,
  serviceStyle?: string | null,
  serviceType?: string | null
): Promise<number[]> {
  const rules = await getDiscoveryRules(roleId, flow, serviceStyle, serviceType);
  const v = rules[ruleKey];
  if (Array.isArray(v)) return v;
  const def = PLATFORM_DEFAULTS[ruleKey];
  return Array.isArray(def) ? def : [5, 10, 20];
}
