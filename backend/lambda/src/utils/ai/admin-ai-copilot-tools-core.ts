/**
 * Admin copilot: allowlisted read-only tools (pure parser + permission matrix).
 * Execution: admin-ai-copilot-tools.ts. Phase 3: add tools one-by-one with explicit permission maps;
 * optional CloudWatch counters and PII stripping on tool outputs before the main model turn.
 */
import { extractFirstJsonObjectString } from './ai-chatbot-response-parse';

/** Local copy to keep this module DB-free for Jest (mirrors admin-rbac-permissions.hasAdminPermission). */
function hasAdminPermissionLocal(permissions: string[] | null | undefined, required: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('admin.full_access')) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export const MAX_ADMIN_COPILOT_TOOL_REQUESTS = 2;
export const MAX_ADMIN_COPILOT_PLANNER_ROUNDS = 3;

export const ADMIN_COPILOT_TOOL_NAMES = [
  'get_pending_vendor_applications_summary',
  'get_platform_setting_json_safe',
  'get_vendor_public_snapshot',
] as const;
export type AdminCopilotToolName = (typeof ADMIN_COPILOT_TOOL_NAMES)[number];

export type AdminCopilotToolRequest = { name: AdminCopilotToolName; args: Record<string, unknown> };

export const ADMIN_COPILOT_TOOL_PASS1_SYSTEM = `You are a **data planner** for the Warmpawz **admin portal** copilot. Output **JSON only** (no markdown, no prose).

Decide which **allowlisted read-only tools** (if any) the assistant needs to answer the admin accurately. If ACCUMULATED_TOOL_RESULTS_JSON appears in the user message, only request tools still missing.

Allowlist (server enforces permissions — never put secrets in args):
- "get_pending_vendor_applications_summary" — counts and recent pending vendor onboarding rows (non-PII summary). Args: {}. Requires admin.vendors.
- "get_platform_setting_json_safe" — read one platform_settings row by key; credentials are stripped server-side. Args: { "key": "admin:settings:ai_copilot" } or { "key": "admin:settings:aws" } only.
- "get_vendor_public_snapshot" — public vendor row fields by id. Args: { "vendorId": "<uuid>" }. Requires admin.vendors.

Output shape:
{ "toolRequests": [] }

Rules:
- At most ${MAX_ADMIN_COPILOT_TOOL_REQUESTS} tools per round.
- If data is already in ACCUMULATED_TOOL_RESULTS_JSON, return "toolRequests": [].
- Do not invent facts; only choose tools.`;

function isAllowedToolName(name: unknown): name is AdminCopilotToolName {
  return typeof name === 'string' && (ADMIN_COPILOT_TOOL_NAMES as readonly string[]).includes(name);
}

export function parseAdminCopilotToolRequestsFromCompletion(completion: string): AdminCopilotToolRequest[] {
  const raw = String(completion ?? '').trim();
  const jsonStr = extractFirstJsonObjectString(raw);
  if (!jsonStr) return [];
  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const tr = p.toolRequests;
    if (!Array.isArray(tr)) return [];
    const out: AdminCopilotToolRequest[] = [];
    for (const item of tr) {
      if (out.length >= MAX_ADMIN_COPILOT_TOOL_REQUESTS) break;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const name = rec.name;
      if (!isAllowedToolName(name)) continue;
      const args =
        rec.args && typeof rec.args === 'object' && !Array.isArray(rec.args) ? (rec.args as Record<string, unknown>) : {};
      out.push({ name, args });
    }
    return out;
  } catch {
    return [];
  }
}

export function toolRequestAllowedForPermissions(
  req: AdminCopilotToolRequest,
  permissions: string[]
): boolean {
  if (req.name === 'get_pending_vendor_applications_summary') {
    return hasAdminPermissionLocal(permissions, 'admin.vendors');
  }
  if (req.name === 'get_platform_setting_json_safe') {
    return hasAdminPermissionLocal(permissions, 'admin.platform_settings');
  }
  if (req.name === 'get_vendor_public_snapshot') {
    return hasAdminPermissionLocal(permissions, 'admin.vendors');
  }
  return false;
}

export function filterAdminCopilotToolRequestsByPermissions(
  requests: AdminCopilotToolRequest[],
  permissions: string[]
): AdminCopilotToolRequest[] {
  return requests.filter((r) => toolRequestAllowedForPermissions(r, permissions));
}

export function formatAdminCopilotToolResultsForPrompt(toolResults: Record<string, unknown>): string {
  if (!toolResults || Object.keys(toolResults).length === 0) return '';
  return `TOOL_RESULTS_JSON (authoritative — use these facts; do not contradict):\n${JSON.stringify(toolResults)}`;
}

/** Heuristic: when to run the multi-round planner (keeps greetings cheap). */
export function adminCopilotMayTriggerDataAgent(message: string): boolean {
  const raw = String(message || '').trim();
  if (raw.length < 8) return false;
  const lower = raw.toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(lower) && raw.length < 40) return false;
  if (/\b(vendor|application|pending|approval|onboarding|re-approval|reapproval)\b/.test(lower)) return true;
  if (/\b(platform setting|bedrock|aws settings|ai copilot|toggle)\b/.test(lower)) return true;
  if (/\?/.test(raw)) return true;
  if (
    /\b(how many|count|list|show|status|what|when|where|why|how)\b/.test(lower) &&
    /\b(vendor|setting|config)\b/.test(lower)
  ) {
    return true;
  }
  return raw.length > 100;
}
