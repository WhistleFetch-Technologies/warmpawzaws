import { extractFirstJsonObjectString } from '../utils/ai/ai-chatbot-response-parse';

export const MAX_COMMERCIAL_TOOL_REQUESTS = 3;
export const MAX_COMMERCIAL_PLANNER_ROUNDS = 2;

export const COMMERCIAL_COPILOT_TOOL_NAMES = [
  'get_promotion_snapshot',
  'get_coupon_snapshot',
  'get_campaign_snapshot',
  'get_campaign_health',
  'get_campaign_analytics',
  'get_runtime_policy_summary',
  'get_discount_analytics_overview',
  'get_campaign_settlement_attribution',
  'get_campaign_notification_link',
] as const;

export type CommercialCopilotToolName = (typeof COMMERCIAL_COPILOT_TOOL_NAMES)[number];

export type CommercialCopilotToolRequest = {
  name: CommercialCopilotToolName;
  args: Record<string, unknown>;
};

export const COMMERCIAL_COPILOT_TOOL_PASS1_SYSTEM = `You are a **Commercial data planner** for Warmpawz admin. Output **JSON only**.

Choose allowlisted **read-only** tools to answer the admin. Use entity ids from COMMERCIAL_CONTEXT when present.

Allowlist:
- get_promotion_snapshot { "promotionId": "<uuid>" }
- get_coupon_snapshot { "couponId": "<uuid>" }
- get_campaign_snapshot { "campaignId": "<uuid>" }
- get_campaign_health { "campaignId": "<uuid>" }
- get_campaign_analytics { "campaignId": "<uuid>" }
- get_runtime_policy_summary { "domain": "SERVICE" | "ECOMMERCE" }
- get_discount_analytics_overview { "domain": "SERVICE" | "ECOMMERCE" }
- get_campaign_settlement_attribution { "campaignId": "<uuid>" }
- get_campaign_notification_link { "campaignId": "<uuid>" }

Output: { "toolRequests": [] }
Max ${MAX_COMMERCIAL_TOOL_REQUESTS} tools per round. No writes. No SQL. No AWS.`;

function isAllowedToolName(name: unknown): name is CommercialCopilotToolName {
  return typeof name === 'string' && (COMMERCIAL_COPILOT_TOOL_NAMES as readonly string[]).includes(name);
}

export function parseCommercialCopilotToolRequestsFromCompletion(
  completion: string
): CommercialCopilotToolRequest[] {
  const jsonStr = extractFirstJsonObjectString(String(completion ?? '').trim());
  if (!jsonStr) return [];
  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const tr = p.toolRequests;
    if (!Array.isArray(tr)) return [];
    const out: CommercialCopilotToolRequest[] = [];
    for (const item of tr) {
      if (out.length >= MAX_COMMERCIAL_TOOL_REQUESTS) break;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      if (!isAllowedToolName(rec.name)) continue;
      const args =
        rec.args && typeof rec.args === 'object' && !Array.isArray(rec.args)
          ? (rec.args as Record<string, unknown>)
          : {};
      out.push({ name: rec.name, args });
    }
    return out;
  } catch {
    return [];
  }
}

export function toolRequestAllowedForCommercialPermissions(
  req: CommercialCopilotToolRequest,
  permissions: string[]
): boolean {
  const has = (p: string) =>
    permissions.includes('admin.full_access') ||
    permissions.includes('*') ||
    permissions.includes(p);

  if (req.name === 'get_runtime_policy_summary') return has('admin.marketing') || has('admin.ai_copilot');
  if (req.name === 'get_discount_analytics_overview') return has('admin.marketing') || has('admin.ai_copilot');
  if (req.name.startsWith('get_campaign')) return has('admin.marketing') || has('admin.ai_copilot');
  if (req.name === 'get_promotion_snapshot' || req.name === 'get_coupon_snapshot') {
    return has('admin.marketing') || has('admin.ai_copilot');
  }
  return has('admin.ai_copilot');
}

export function filterCommercialCopilotToolRequestsByPermissions(
  requests: CommercialCopilotToolRequest[],
  permissions: string[]
): CommercialCopilotToolRequest[] {
  return requests.filter((r) => toolRequestAllowedForCommercialPermissions(r, permissions));
}

export function formatCommercialCopilotToolResultsForPrompt(
  toolResults: Record<string, unknown>
): string {
  if (!toolResults || !Object.keys(toolResults).length) return '';
  return `TOOL_RESULTS_JSON (authoritative live runtime — do not invent facts):\n${JSON.stringify(toolResults)}`;
}

export function commercialCopilotMayTriggerInvestigation(message: string): boolean {
  const raw = String(message || '').trim();
  if (raw.length < 6) return false;
  return /\b(why|failed|critical|inactive|health|analytics|settlement|amount|apply|status|investigate)\b/i.test(
    raw
  );
}
