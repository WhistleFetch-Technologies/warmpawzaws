/**
 * Pure vendor-tool parsing / heuristics (no RDS import — safe for unit tests).
 * DB + Bedrock orchestration lives in ai-vendor-chat-tools.ts.
 *
 * Phase 2: add tools here (allowlist + parser) and wire execution in ai-vendor-chat-tools.ts.
 */

import { extractFirstJsonObjectString } from './ai-chatbot-response-parse';

export const MAX_VENDOR_TOOL_REQUESTS = 2;

/** Planner may run this many Bedrock rounds; each round can request up to MAX_VENDOR_TOOL_REQUESTS tools. */
export const MAX_VENDOR_AGENT_PLANNER_ROUNDS = 3;

export const VENDOR_CHAT_TOOL_NAMES = [
  'get_vendor_tele_flags',
  'get_vendor_booking_revenue_month',
  'get_vendor_recent_bookings',
  'get_vendor_services_snapshot',
] as const;
export type VendorChatToolName = (typeof VENDOR_CHAT_TOOL_NAMES)[number];

export type VendorToolRequest = { name: VendorChatToolName; args: Record<string, unknown> };

export const VENDOR_TOOL_PASS1_SYSTEM = `You are a **data planner** for the Warmpawz **vendor** assistant. Output **JSON only** (no markdown, no prose).

Your job: decide which **allowlisted read-only DB tools** (if any) the next assistant turn needs so it can answer the vendor accurately. You may see ACCUMULATED_TOOL_RESULTS_JSON from earlier rounds in the same user message — request **only** tools that are still missing for the question.

Allowlist (server enforces vendor_id from auth — never put vendor IDs in args):
- "get_vendor_tele_flags" — instant tele catalog flag on the vendor row. Args: {}.
- "get_vendor_booking_revenue_month" — gross completed booking revenue for current or previous calendar month. Args: { "period": "current_month" } or { "period": "previous_month" }.
- "get_vendor_recent_bookings" — latest bookings (id, dates, status, service_type, amounts). Args: { "limit": 5 } optional; limit 1–15, default 5.
- "get_vendor_services_snapshot" — this vendor's services (names, styles, enabled, publish_status, price). Args: {}.

Output shape (always valid JSON):
{ "toolRequests": [] }

Example with tools:
{ "toolRequests": [ { "name": "get_vendor_services_snapshot", "args": {} } ] }

Rules:
- At most ${MAX_VENDOR_TOOL_REQUESTS} tools per round.
- If ACCUMULATED_TOOL_RESULTS_JSON already contains everything needed, return "toolRequests": [].
- Do not invent facts; only choose tools. If unsure, prefer fewer tools.
`;

/** True when the message is asking for month-scoped booking revenue (triggers DB tool + optional no-Bedrock fallback). */
export function vendorChatMayTriggerBookingRevenueTool(message: string): boolean {
  const m = String(message || '').toLowerCase().trim();
  if (m.length < 4) return false;
  const earnPhrase =
    /\b(how much|revenue|earning|earnings|income|gross|payout|settlement|money|rupees?|inr|₹)\b/.test(m) ||
    (/\bmade\b/.test(m) && /\b(money|much|earn|revenue|profit)\b/.test(m));
  const earnTime =
    /\b(this month|the month|calendar month|month so far|mtd|last month|previous month|prior month|this week|week so far|today|ytd)\b/.test(
      m
    );
  return earnPhrase && earnTime;
}

export function vendorChatMayTriggerToolPass(message: string): boolean {
  const m = String(message || '').toLowerCase().trim();
  if (m.length < 4) return false;
  if (/\binstant\s*tele/.test(m)) return true;
  if (/\bteleconsult|\btele\s*consult|\binstant\s*consult|\bvideo\s*consult/.test(m)) return true;
  if (/\btele\b/.test(m) && /\b(on|off|enable|disabled?|toggle|available|queue|turn|showing|listed)\b/.test(m)) return true;
  if (/\b(is\s+it\s+on|am\s+i\s+visible|customers\s+see|appear\s+in)\b/.test(m)) return true;
  if (vendorChatMayTriggerBookingRevenueTool(message)) return true;
  return false;
}

/**
 * When true, run the multi-round RDS tool planner before the main vendor Bedrock reply.
 * Keeps short greetings cheap; broader than tele/earnings-only heuristics.
 */
export function vendorChatMayTriggerDataAgent(message: string): boolean {
  const raw = String(message || '').trim();
  if (raw.length < 6) return false;
  const lower = raw.toLowerCase();
  if (/\b(hi|hello|hey|hii)\b/.test(lower) && raw.length < 36) return false;
  if (vendorChatMayTriggerToolPass(message)) return true;
  if (/\?/.test(raw)) return true;
  if (
    /\b(why|how|what|when|where|who|how many|which|list|show|status|missing|broken|error|not working|cannot|can't|dont|don't|appear|visible|discover|search|customer|booking|bookings|schedule|service|services|payout|earning|revenue|payment|online|offline|available|availability)\b/.test(
      lower
    )
  ) {
    return true;
  }
  return raw.length > 120;
}

function isAllowedToolName(name: unknown): name is VendorChatToolName {
  return typeof name === 'string' && (VENDOR_CHAT_TOOL_NAMES as readonly string[]).includes(name);
}

export function parseVendorToolRequestsFromCompletion(completion: string): VendorToolRequest[] {
  const raw = String(completion ?? '').trim();
  const jsonStr = extractFirstJsonObjectString(raw);
  if (!jsonStr) return [];
  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const tr = p.toolRequests;
    if (!Array.isArray(tr)) return [];
    const out: VendorToolRequest[] = [];
    for (const item of tr) {
      if (out.length >= MAX_VENDOR_TOOL_REQUESTS) break;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const name = rec.name;
      if (!isAllowedToolName(name)) continue;
      const args = rec.args && typeof rec.args === 'object' && !Array.isArray(rec.args) ? (rec.args as Record<string, unknown>) : {};
      out.push({ name, args });
    }
    return out;
  } catch {
    return [];
  }
}

export function formatVendorToolResultsForPrompt(toolResults: Record<string, unknown>): string {
  if (!toolResults || Object.keys(toolResults).length === 0) return '';
  return `TOOL_RESULTS_JSON (authoritative — use these facts in your answer; do not contradict):\n${JSON.stringify(toolResults)}`;
}

export type VendorQueryFn = (sql: string, params?: unknown[]) => Promise<{ rows?: Record<string, unknown>[] }>;

async function runGetVendorTeleFlags(vendorId: string, runQuery: VendorQueryFn): Promise<Record<string, unknown>> {
  const res = await runQuery(
    `SELECT COALESCE(available_for_instant_tele, false) AS available_for_instant_tele
     FROM vendors WHERE id = $1 LIMIT 1`,
    [vendorId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  const v = row?.available_for_instant_tele;
  const available = v === true || v === 't' || String(v).toLowerCase() === 'true';
  return { availableForInstantTele: available, source: 'vendors.available_for_instant_tele' };
}

export type VendorBookingRevenueMonthPeriod = 'current_month' | 'previous_month';

async function runGetVendorBookingRevenueMonth(
  vendorId: string,
  runQuery: VendorQueryFn,
  period: VendorBookingRevenueMonthPeriod
): Promise<Record<string, unknown>> {
  const isPrev = period === 'previous_month';
  const windowSql = isPrev
    ? `b.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
       AND b.created_at < DATE_TRUNC('month', CURRENT_DATE)`
    : `b.created_at >= DATE_TRUNC('month', CURRENT_DATE)
       AND b.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;

  const res = await runQuery(
    `SELECT
        COUNT(*)::int AS completed_booking_count,
        COALESCE(SUM(b.total_amount), 0)::text AS gross_total
      FROM bookings b
      WHERE b.vendor_id = $1
        AND LOWER(TRIM(b.status)) = 'completed'
        AND ${windowSql}`,
    [vendorId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  const completedBookingsCount = parseInt(String(row?.completed_booking_count ?? '0'), 10) || 0;
  const grossBookingTotalInr = parseFloat(String(row?.gross_total ?? '0')) || 0;

  return {
    period,
    completedBookingsCount,
    grossBookingTotalInr,
    currency: 'INR',
    note:
      'Gross sum of total_amount for bookings marked completed whose created_at falls in the calendar month window (DB server date). Net after commission and bank payouts may differ; Reporting shows settlement detail.',
    source: 'bookings (admin-dashboard-aligned month revenue)',
  };
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

async function runGetVendorRecentBookings(
  vendorId: string,
  runQuery: VendorQueryFn,
  limit: number
): Promise<Record<string, unknown>> {
  const lim = clampInt(limit, 1, 15, 5);
  const res = await runQuery(
    `SELECT b.id, b.service_type, b.status, b.booking_date, b.created_at, b.total_amount
     FROM bookings b
     WHERE b.vendor_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [vendorId, lim]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  return {
    limit: lim,
    bookings: (res.rows || []).map((r) => ({
      id: r.id,
      serviceType: r.service_type,
      status: r.status,
      bookingDate: r.booking_date,
      createdAt: r.created_at,
      totalAmount: r.total_amount != null ? parseFloat(String(r.total_amount)) : null,
    })),
    source: 'bookings',
  };
}

async function runGetVendorServicesSnapshot(vendorId: string, runQuery: VendorQueryFn): Promise<Record<string, unknown>> {
  const res = await runQuery(
    `SELECT vs.id,
            vs.service_name,
            vs.service_style,
            vs.category,
            vs.is_enabled,
            vs.publish_status,
            COALESCE(vs.custom_price, vs.price, 0)::float AS unit_price
     FROM vendor_services vs
     WHERE vs.vendor_id = $1
     ORDER BY vs.service_name NULLS LAST
     LIMIT 40`,
    [vendorId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  return {
    services: (res.rows || []).map((r) => ({
      id: r.id,
      name: r.service_name,
      serviceStyle: r.service_style,
      category: r.category,
      isEnabled: r.is_enabled === true || r.is_enabled === 't',
      publishStatus: r.publish_status,
      unitPrice: r.unit_price,
    })),
    source: 'vendor_services',
  };
}

export async function executeVendorToolRequestsWithQuery(
  vendorId: string,
  requests: VendorToolRequest[],
  runQuery: VendorQueryFn
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  for (const req of requests) {
    if (req.name === 'get_vendor_tele_flags') {
      results.get_vendor_tele_flags = await runGetVendorTeleFlags(vendorId, runQuery);
    } else if (req.name === 'get_vendor_booking_revenue_month') {
      const p: VendorBookingRevenueMonthPeriod =
        req.args?.period === 'previous_month' ? 'previous_month' : 'current_month';
      results.get_vendor_booking_revenue_month = await runGetVendorBookingRevenueMonth(vendorId, runQuery, p);
    } else if (req.name === 'get_vendor_recent_bookings') {
      const lim = clampInt(req.args?.limit, 1, 15, 5);
      results.get_vendor_recent_bookings = await runGetVendorRecentBookings(vendorId, runQuery, lim);
    } else if (req.name === 'get_vendor_services_snapshot') {
      results.get_vendor_services_snapshot = await runGetVendorServicesSnapshot(vendorId, runQuery);
    }
  }
  return results;
}
