/**
 * ============================================================================
 * AI CHATBOT ENDPOINTS - AWS BEDROCK INTEGRATION
 * ============================================================================
 * 
 * Handles AI chatbot features:
 * - General chat with intent classification
 * - Symptoms checker
 * - Smart booking assist
 * - Customer support
 * - Agent handoff to CRM
 * 
 * Date: 2026-01-07
 * Phase 3: AI Chatbot Integration
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../database/rds-connection';
import { invokeBedrock, BEDROCK_GUARDRAIL_BLOCKED } from '../../utils/bedrock-client';
import { withRetry } from '../../utils/error-recovery';
import { generateSupportTicketNumber } from '../../utils/support-ticket-number';
import { logErrorSafe, redactForLog } from '../../utils/redact-for-log';
import {
  parseChatBedrockCompletion,
  parseSymptomsBedrockCompletion,
  parseBookingAssistBedrockCompletion,
} from '../../utils/ai/ai-chatbot-response-parse';
import { getCustomerCoordinates } from '../../utils/customer-coordinates';
import { lookupNearbyBookingVendors, type NearbyBookingVendorRow } from '../../utils/ai/ai-chatbot-nearby-vendors';
import { roleFilterListForCategory } from '../../utils/ai/ai-chatbot-booking-roles';
import { sqlAndVendorHasBookableV2Windows } from '../../utils/ai/ai-chatbot-vendor-has-schedule';

const GUARDRAIL_CHAT_FALLBACK =
  "I'm not able to respond to that in a way that meets our safety guidelines. Try rephrasing, or use **Contact support** for help.";

function inferBookingCategoryFromText(msg: string): string {
  const m = msg.toLowerCase();
  // \\bgroom\\b does not match "grooming" — include full words
  if (/\b(grooming|groom|groomer|bath|trim|haircut|nail\s*clip)\b/.test(m)) return 'grooming';
  if (/\b(walk|walker|walking)\b/.test(m)) return 'walker';
  if (/\b(train|trainer|training|behavior|behaviourist)\b/.test(m)) return 'training';
  if (/\b(board|boarding|kennel|daycare)\b/.test(m)) return 'boarding';
  if (/\b(vet|veterinar|veterinary|doctor|clinic|tele\s*consult|consultation)\b/.test(m)) return 'vet';
  if (/\b(pharmacy|medicine|medication)\b/.test(m)) return 'pharmacy';
  if (/\b(cafe|café)\b/.test(m)) return 'cafe';
  if (/\b(resort|holiday)\b/.test(m)) return 'resort';
  if (/\b(sitter|pet\s*sit|sitting)\b/.test(m)) return 'walker';
  return '';
}

const BOOKING_SEARCH_CATEGORY_SET = new Set([
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'pharmacy',
  'cafe',
  'resort',
]);

function inferBookingAssistIntentFromText(message: string): 'trouble' | 'discover' {
  const m = String(message || '').toLowerCase().trim();
  const troublePattern =
    /\b(unable|can't|cannot|failed|error|stuck|not working|doesn't work|won't|problem|issue|help me book)\b/;
  const bookingPattern = /\b(book|booking|payment|checkout|slot|appointment)\b/;
  if (troublePattern.test(m) && bookingPattern.test(m)) return 'trouble';
  return 'discover';
}

function normalizeServiceTypeToCategory(serviceType: string): string {
  const s = String(serviceType || '')
    .toLowerCase()
    .trim();
  if (BOOKING_SEARCH_CATEGORY_SET.has(s)) return s;
  if (s === 'other' || s === 'general' || s === '' || s === 'unknown') return '';
  return '';
}

/** Prefer category from user words / model; do not fall back unknown → vet */
function normalizeCustomerBookingUrl(serviceType: string, bookingQuery: string): string {
  const inferred = inferBookingCategoryFromText(bookingQuery);
  const fromModel = normalizeServiceTypeToCategory(serviceType);
  const cat = inferred || fromModel;
  const q = encodeURIComponent(bookingQuery.trim().slice(0, 120));
  const safeCat = cat && BOOKING_SEARCH_CATEGORY_SET.has(cat) ? cat : '';
  if (safeCat) {
    return `/search?category=${safeCat}${q ? `&q=${q}` : ''}`;
  }
  return q ? `/search?q=${q}` : `/search`;
}

function supportCategoryForIntent(intent: string): string {
  const i = String(intent || '').toLowerCase();
  if (i === 'shopping' || i === 'vendor_payouts') return 'billing';
  if (
    i === 'booking' ||
    i === 'symptoms' ||
    i === 'vendor_bookings' ||
    i === 'vendor_services' ||
    i === 'service'
  ) {
    return 'service';
  }
  return 'general';
}

async function linkAiConversationRowsToTicket(
  conversationId: string,
  ticketId: string,
  escalationReason?: string
): Promise<void> {
  const reason = escalationReason || 'Escalated';
  await query(
    `UPDATE ai_chatbot_conversations SET
       escalation_ticket_id = $1::uuid,
       escalated_to_agent = true,
       escalation_reason = COALESCE(escalation_reason, $2::text),
       updated_at = NOW()
     WHERE conversation_id = $3
       AND (
         escalation_ticket_id IS NULL
         OR escalation_ticket_id::text = $1::text
       )`,
    [ticketId, reason, conversationId]
  ).catch(() => undefined);
}

async function findOpenEscalationTicketForConversation(
  conversationId: string
): Promise<string | null> {
  const r = await query(
    `SELECT id::text AS id FROM support_tickets
     WHERE status IN ('open', 'ai_acknowledged', 'awaiting_assignment', 'assigned', 'in_progress')
       AND COALESCE(metadata->>'ai_conversation_id','') = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [conversationId]
  ).catch(() => ({ rows: [] as { id: string }[] }));
  const id = r.rows?.[0]?.id;
  return id ? String(id) : null;
}

type EnsureEscalationTicketArgs = {
  conversationId: string;
  customerId?: string | null;
  customerPhone?: string | null;
  vendorId?: string | null;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  intent?: string;
  confidence?: number;
  escalationReason?: string;
};

/**
 * One open ticket per AI conversation (metadata.ai_conversation_id); links all transcript rows.
 * Caps new tickets per conversation per rolling window to avoid storms (env-tuned).
 */
async function ensureEscalationTicket(
  args: EnsureEscalationTicketArgs
): Promise<{ ticketId: string; created: boolean; capReached?: boolean }> {
  const existingId = await findOpenEscalationTicketForConversation(args.conversationId);
  if (existingId) {
    await linkAiConversationRowsToTicket(
      args.conversationId,
      existingId,
      args.escalationReason
    );
    if (args.priority === 'high') {
      await update(
        'support_tickets',
        { id: existingId },
        {
          priority: 'high',
          last_updated_at: new Date().toISOString(),
        }
      ).catch(() => undefined);
    }
    return { ticketId: existingId, created: false };
  }

  const capHoursRaw = parseInt(process.env.AI_CHATBOT_TICKET_CAP_HOURS || '24', 10);
  const capHours = Number.isFinite(capHoursRaw) ? Math.min(168, Math.max(1, capHoursRaw)) : 24;
  const maxTicketsRaw = parseInt(process.env.AI_CHATBOT_MAX_TICKETS_PER_CONV_PER_DAY || '3', 10);
  const maxTickets = Number.isFinite(maxTicketsRaw) ? Math.max(1, maxTicketsRaw) : 3;

  const countRes = await query(
    `SELECT COUNT(*)::int AS cnt FROM support_tickets
     WHERE source = 'ai_chatbot'
       AND COALESCE(metadata->>'ai_conversation_id','') = $1
       AND created_at > NOW() - ($2::int * INTERVAL '1 hour')`,
    [args.conversationId, capHours]
  ).catch(() => ({ rows: [{ cnt: 0 }] as { cnt: number }[] }));
  const recentCount = countRes.rows?.[0]?.cnt ?? 0;
  if (recentCount >= maxTickets) {
    const latest = await query(
      `SELECT id::text AS id FROM support_tickets
       WHERE source = 'ai_chatbot'
         AND COALESCE(metadata->>'ai_conversation_id','') = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [args.conversationId]
    ).catch(() => ({ rows: [] as { id: string }[] }));
    const ticketId = latest.rows?.[0]?.id ? String(latest.rows[0].id) : '';
    if (ticketId) {
      await linkAiConversationRowsToTicket(args.conversationId, ticketId, args.escalationReason);
    }
    return { ticketId, created: false, capReached: true };
  }

  const metadata: Record<string, unknown> = {
    ai_conversation_id: args.conversationId,
    last_intent: args.intent ?? null,
    last_confidence: args.confidence ?? null,
    attachments: [],
  };
  if (args.vendorId) {
    metadata.vendor_id = args.vendorId;
  }

  const ticket = await insert('support_tickets', {
    ticket_number: generateSupportTicketNumber(),
    customer_id: args.customerId || null,
    customer_phone: args.customerPhone || null,
    vendor_id: args.vendorId || null,
    subject: redactForLog(args.subject, 500),
    message: redactForLog(args.message, 8000),
    source: 'ai_chatbot',
    status: 'open',
    priority: args.priority,
    category: supportCategoryForIntent(args.intent || 'general'),
    metadata,
    created_at: new Date().toISOString(),
  });

  const ticketId = ticket[0]?.id ? String(ticket[0].id) : '';
  if (ticketId) {
    await linkAiConversationRowsToTicket(args.conversationId, ticketId, args.escalationReason);
    const { recordSupportTicketActivity, SUPPORT_TICKET_EVENT_TYPES } = await import(
      '../supportCrm/support-ticket-activity'
    );
    const { scheduleSupportTicketAiAck } = await import('../supportCrm/support-ticket-ai-ack');
    void recordSupportTicketActivity({
      ticketId,
      eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CREATED,
      eventActorType: 'customer',
      eventActorId: args.customerId || null,
      eventTitle: 'Ticket created (AI escalation)',
      eventMetadata: { source: 'ai_chatbot', conversationId: args.conversationId },
    });
    scheduleSupportTicketAiAck(ticketId);
  }
  return { ticketId, created: true };
}

function shortSupportTicketRefForUser(ticketId: string): string {
  return ticketId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Bedrock runs before we know ticketId — append a factual line so the assistant's text matches API behavior.
 */
function appendSupportTicketAckToResponse(
  responseText: string,
  opts: { ticketId: string; created: boolean; capReached: boolean; isVendorSession: boolean }
): string {
  const base = responseText.trim();
  if (!opts.ticketId || opts.capReached) return base;

  const ref = shortSupportTicketRefForUser(opts.ticketId);
  if (/\blogged a support request from this chat\b/i.test(base)) return base;
  if (/\blinked to (?:your )?open support request\b/i.test(base)) return base;
  if (new RegExp(`\\b${ref}\\b`, 'i').test(base)) return base;

  const tail = opts.isVendorSession
    ? opts.created
      ? `\n\nWarmpawz has **logged a support request** from this chat so our team can follow up. Open **Support** in your vendor app to track it — your reference starts with **${ref}**.`
      : `\n\nThis chat is **linked to your open support request**. Open **Support** in your vendor app to continue — reference **${ref}**.`
    : opts.created
      ? `\n\nWarmpawz has **logged a support request** from this chat. Open **Help & Support** to track it — reference **${ref}**.`
      : `\n\nThis chat is **linked to an open support request**. Open **Help & Support** — reference **${ref}**.`;

  return `${base}${tail}`.trim();
}

function formatChatPreviousTurns(contextObj: Record<string, unknown>): string {
  const pm = contextObj.previousMessages;
  if (!Array.isArray(pm) || pm.length === 0) return '';
  const lines = pm
    .slice(-3)
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return '';
      const m = entry as { role?: string; content?: string };
      const role = m.role === 'assistant' ? 'Assistant' : 'User';
      const content = String(m.content || '').slice(0, 160);
      if (!content) return '';
      return `${role}: ${content}`;
    })
    .filter(Boolean);
  if (lines.length === 0) return '';
  return `\nRECENT CONVERSATION (last turns):\n${lines.join('\n')}\n`;
}

/** Optional per-vendor AI tuning in vendors.other_config JSON: { "ai_chat": { ... } } */
type VendorAiChatConfig = {
  systemPromptSuffix?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

function parseVendorAiChatFromOtherConfig(otherConfig: unknown): VendorAiChatConfig {
  if (!otherConfig || typeof otherConfig !== 'object') return {};
  const oc = otherConfig as Record<string, unknown>;
  const ac = oc.ai_chat;
  if (!ac || typeof ac !== 'object') return {};
  const c = ac as Record<string, unknown>;
  const out: VendorAiChatConfig = {};
  if (typeof c.systemPromptSuffix === 'string' && c.systemPromptSuffix.trim()) {
    out.systemPromptSuffix = c.systemPromptSuffix.trim().slice(0, 2000);
  }
  if (typeof c.temperature === 'number' && Number.isFinite(c.temperature)) {
    out.temperature = Math.min(1, Math.max(0, c.temperature));
  }
  if (typeof c.maxTokens === 'number' && Number.isFinite(c.maxTokens)) {
    out.maxTokens = Math.min(4096, Math.max(256, Math.round(c.maxTokens)));
  }
  if (typeof c.topP === 'number' && Number.isFinite(c.topP)) {
    out.topP = Math.min(1, Math.max(0.01, c.topP));
  }
  return out;
}

/** Services + offering vendors for booking assist. */
async function lookupBookingContext(bookingQuery: string): Promise<{
  services: Array<{ id: string; name: string; serviceStyle?: string }>;
  vendors: Array<{ id: string; businessName: string; city?: string }>;
}> {
  const q = bookingQuery.trim().slice(0, 120);
  if (!q) return { services: [], vendors: [] };

  const servRes = await query(
    `SELECT id, name, service_style FROM services 
     WHERE is_active = true AND name ILIKE $1 
     ORDER BY created_at DESC NULLS LAST LIMIT 10`,
    [`%${q}%`]
  ).catch(() => ({ rows: [] as any[] }));

  const services = (servRes.rows || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    serviceStyle: s.service_style,
  }));

  const ids = services.map((s) => s.id).filter(Boolean);
  let vendors: Array<{ id: string; businessName: string; city?: string }> = [];
  if (ids.length > 0) {
    const vRes = await query(
      `SELECT DISTINCT v.id, v.business_name, v.city
       FROM vendors v
       INNER JOIN vendor_services vs ON vs.vendor_id = v.id AND vs.is_enabled = true
       WHERE v.status = 'approved' AND v.is_active = true
         AND vs.service_id = ANY($1::uuid[])
         AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
         AND ${sqlAndVendorHasBookableV2Windows('v')}
       ORDER BY v.created_at DESC
       LIMIT 10`,
      [ids]
    ).catch(() => ({ rows: [] as any[] }));
    vendors = (vRes.rows || []).map((v: any) => ({
      id: v.id,
      businessName: v.business_name,
      city: v.city,
    }));
  }

  return { services, vendors };
}

/**
 * When geo+VA2 nearby returns nobody, still return approved vendors for this discovery category (any role).
 * Same idea as vet-only fallback, extended to grooming, walker, training, etc.
 */
async function lookupVendorsBookingFallbackByCategory(
  category: string,
  limit: number
): Promise<Array<{ id: string; businessName: string; city?: string; roleName?: string }>> {
  const roles = roleFilterListForCategory(category);
  if (roles.length === 0) return [];
  const vendRes = await query(
    `SELECT v.id, v.business_name, v.city, r.name as role_name
     FROM vendors v
     INNER JOIN roles r ON v.role_id = r.id
     WHERE v.status = 'approved' AND v.is_active = true
       AND LOWER(TRIM(r.name)) = ANY($1::text[])
     ORDER BY v.created_at DESC
     LIMIT $2`,
    [roles, limit]
  ).catch(() => ({ rows: [] as any[] }));
  return (vendRes.rows || []).map((v: any) => ({
    id: String(v.id),
    businessName: String(v.business_name ?? 'Provider'),
    city: v.city != null ? String(v.city) : undefined,
    roleName: v.role_name != null ? String(v.role_name) : undefined,
  }));
}

function parseLocationFromBody(location: unknown): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'object' || Array.isArray(location)) return null;
  const o = location as Record<string, unknown>;
  const rawLat = o.lat ?? o.latitude;
  const rawLng = o.lng ?? o.longitude;
  const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat ?? ''));
  const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng ?? ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function resolveNearbyBookingCategory(bookingQuery: string): string | null {
  let cat = inferBookingCategoryFromText(bookingQuery);
  if (cat && BOOKING_SEARCH_CATEGORY_SET.has(cat) && cat !== 'other') return cat;
  if (/\b(doctor|dr\.?|vet|veterinar|veterinary|clinic|hospital)\b/i.test(bookingQuery)) return 'vet';
  if (cat && BOOKING_SEARCH_CATEGORY_SET.has(cat) && cat === 'other') return null;
  return null;
}

/** Combine user text, then model serviceType, so vague queries still get nearby + fallbacks for grooming, walker, etc. */
function resolveEffectiveBookingCategory(
  bookingQuery: string,
  nearbyCategoryFromText: string | null,
  serviceTypeFromModel: string
): string | null {
  const inferred = inferBookingCategoryFromText(bookingQuery);
  const fromModel = normalizeServiceTypeToCategory(serviceTypeFromModel);
  const seq = [nearbyCategoryFromText, inferred || null, fromModel || null];
  for (const s of seq) {
    if (!s) continue;
    const x = String(s).toLowerCase();
    if (BOOKING_SEARCH_CATEGORY_SET.has(x) && x !== 'other') return x;
  }
  return null;
}

function appendNearbyBookingProvidersToResponse(base: string, rows: NearbyBookingVendorRow[]): string {
  if (!rows.length) return base.trim();
  const lines = rows.slice(0, 8).map((v) => {
    const loc = v.city ? ` — ${v.city}` : '';
    return `• ${v.businessName}${loc} (~${v.distanceKm} km)`;
  });
  return `${base.trim()}\n\n**Providers near you**\n${lines.join('\n')}`;
}

function appendBookingContextToResponse(
  baseResponse: string,
  services: Array<{ name: string }>,
  vendors: Array<{ businessName: string; city?: string; id: string }>
): string {
  const lines: string[] = [baseResponse.trim()];
  if (services.length > 0) {
    lines.push('\n\n**Matching services in our catalog**');
    services.slice(0, 8).forEach((s) => lines.push(`• ${s.name}`));
  }
  if (vendors.length > 0) {
    lines.push('\n**Providers offering these services**');
    vendors.slice(0, 8).forEach((v) => {
      const loc = v.city ? ` — ${v.city}` : '';
      lines.push(`• ${v.businessName}${loc}`);
    });
  }
  return lines.join('\n');
}

export function registerAIChatbotEndpoints(app: Hono) {
  /**
   * POST /ai-chatbot/chat
   * Main AI chatbot endpoint with intent classification
   */
  app.post("/ai-chatbot/chat", async (c) => {
    try {
      // Invariant: never interpolate platform admin AWS settings, credentials, connection strings, or other secrets into prompts.
      const body = await c.req.json();
      const {
        message,
        customerId,
        customerPhone,
        conversationId,
        context,
        petId,
        vendorId: vendorIdFromBody,
      } = body;

      if (!message) {
        return c.json({ error: 'message is required' }, 400);
      }

      const ctx =
        context && typeof context === 'object' && !Array.isArray(context)
          ? (context as Record<string, unknown>)
          : {};
      const widgetMode =
        typeof ctx.widgetMode === 'string' ? String(ctx.widgetMode).trim().toLowerCase() : '';
      const ctxUserType = ctx.userType === 'vendor' ? 'vendor' : 'customer';
      const ctxUserName = typeof ctx.userName === 'string' ? ctx.userName.trim() : '';

      const effectiveVendorId =
        (typeof vendorIdFromBody === 'string' && vendorIdFromBody) ||
        (ctxUserType === 'vendor' && typeof customerId === 'string' && customerId ? customerId : '') ||
        '';
      const isVendorSession = ctxUserType === 'vendor' || !!effectiveVendorId;

      const transcriptHint = formatChatPreviousTurns(ctx);

      // Generate or use conversation ID
      const currentConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      let customerContext = '';
      let vendorContext = '';
      let vendorProfileBlock = '';
      let vendorAiSuffix = '';
      /** Bedrock generation params — only applied when isVendorSession; customer path uses fixed defaults below. */
      let vendorBedrockOpts = { maxTokens: 1024, temperature: 0.45, topP: 0.9 };
      let petContext = '';
      let bookingContext = '';

      if (isVendorSession && effectiveVendorId) {
        try {
          const vendorRes = await query(
            `SELECT v.business_name, v.owner_name, v.category, v.tier, v.city, v.state, v.specialization,
                    v.home_service_enabled, v.other_config,
                    COALESCE(NULLIF(TRIM(r.display_name), ''), r.name) AS role_name
             FROM vendors v
             LEFT JOIN roles r ON r.id = v.role_id
             WHERE v.id = $1
             LIMIT 1`,
            [effectiveVendorId]
          );
          const row = vendorRes.rows?.[0] as Record<string, unknown> | undefined;
          if (row) {
            const label =
              (row.business_name as string) ||
              (row.owner_name as string) ||
              ctxUserName ||
              'Vendor';
            vendorContext = `Vendor provider: ${label} (id: ${effectiveVendorId})`;
            const profileLines = [
              `- Business / display name: ${label}`,
              row.role_name ? `- Provider role: ${String(row.role_name)}` : null,
              row.category ? `- Category: ${String(row.category)}` : null,
              row.tier ? `- Tier: ${String(row.tier)}` : null,
              row.city || row.state
                ? `- Location: ${[row.city, row.state].filter(Boolean).join(', ')}`
                : null,
              row.specialization
                ? `- Specialization (summary): ${String(row.specialization).slice(0, 120)}`
                : null,
              `- Home visits offered: ${row.home_service_enabled ? 'yes' : 'no'}`,
            ].filter(Boolean);
            vendorProfileBlock = `VENDOR PROFILE (personalize tone and examples; never invent payouts, bank details, or private data):\n${profileLines.join('\n')}\n`;

            const aiCfg = parseVendorAiChatFromOtherConfig(row.other_config);
            if (aiCfg.systemPromptSuffix) {
              vendorAiSuffix = aiCfg.systemPromptSuffix;
            }
            vendorBedrockOpts = {
              maxTokens: aiCfg.maxTokens ?? 1024,
              temperature: aiCfg.temperature ?? 0.45,
              topP: aiCfg.topP ?? 0.9,
            };
          } else if (ctxUserName) {
            vendorContext = `Vendor provider (signed in as): ${ctxUserName}`;
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-vendor-context', e);
        }
      } else if (isVendorSession && ctxUserName) {
        vendorContext = `Vendor provider (signed in as): ${ctxUserName}`;
      }

      if (!isVendorSession && (customerId || customerPhone)) {
        try {
          const customerResult = customerId
            ? await select('customers', { id: customerId })
            : await query(`SELECT * FROM customers WHERE phone = $1 LIMIT 1`, [customerPhone]);

          const customers = Array.isArray(customerResult) ? customerResult : customerResult.rows || [];
          if (customers.length > 0) {
            const cust = customers[0];
            customerContext = `Customer: ${cust.first_name || ''} ${cust.last_name || ''}`.trim();
            if (cust.phone || customerPhone) {
              customerContext += ' (verified account)';
            }
            customerContext = customerContext.slice(0, 120);
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-customer-context', e);
        }
      }

      // Fetch pet context
      if (petId) {
        try {
          const pets = await select('pets', { id: petId });
          if (pets.length > 0) {
            const pet = pets[0];
            petContext = `Pet: ${pet.name || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || 'Unknown'}`.slice(
              0,
              180
            );
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-pet-context', e);
        }
      }

      // Fetch recent bookings context (vendor vs customer)
      if (isVendorSession && effectiveVendorId) {
        try {
          const bookings = await query(
            `SELECT id, service_type, booking_date, status 
             FROM bookings 
             WHERE vendor_id = $1
             ORDER BY created_at DESC 
             LIMIT 3`,
            [effectiveVendorId]
          );
          if (bookings.rows && bookings.rows.length > 0) {
            bookingContext = `Recent bookings for this provider: ${bookings.rows
              .map((b: any) => `${b.service_type} (${b.status})`)
              .join(', ')}`.slice(0, 320);
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-vendor-bookings', e);
        }
      } else if (!isVendorSession && (customerId || customerPhone)) {
        try {
          const bookings = await query(
            `SELECT id, service_type, booking_date, status 
             FROM bookings 
             WHERE customer_id = $1 OR customer_phone = $2
             ORDER BY created_at DESC 
             LIMIT 2`,
            [customerId || null, customerPhone || null]
          );
          if (bookings.rows && bookings.rows.length > 0) {
            bookingContext = `Recent Bookings: ${bookings.rows
              .map((b: any) => `${b.service_type} (${b.status})`)
              .join(', ')}`.slice(0, 280);
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-customer-bookings', e);
        }
      }

      // Featured products — customer chat only (vendor assistant does not need shop catalog in context)
      let storeContext = '';
      if (!isVendorSession) {
        try {
          const products = await query(
            `SELECT name, sale_price, base_price FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 4`
          );
          if (products.rows && products.rows.length > 0) {
            storeContext = `Featured Products:\n${products.rows
              .map((p: any) => `- ${String(p.name || '').slice(0, 56)} (₹${p.sale_price || p.base_price || 0})`)
              .join('\n')}`.slice(0, 400);
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-products', e);
        }
      }

      const chatTabUiHint =
        !isVendorSession && widgetMode === 'chat'
          ? `UI CONTEXT: The customer is using the **Chat** tab (general support). For suggestedActions, prefer **Create Ticket** and **Contact Support**. Do not suggest **Find Vet Clinic** or **Browse Services** unless the user clearly asks for a vet or to browse/book services.\n\n`
          : '';

      const customerSystemPrompt = `You are the Warmpawz AI Assistant, a helpful and friendly pet care assistant.

${chatTabUiHint}ROLE: Help customers with pet care, shopping, bookings, and support.

CONTEXT:
${customerContext ? `- ${customerContext}\n` : ''}${petContext ? `- ${petContext}\n` : ''}${bookingContext ? `- ${bookingContext}\n` : ''}${storeContext ? `- ${storeContext}\n` : ''}${transcriptHint}

CAPABILITIES:
1. Symptoms Checker: Analyze pet symptoms and provide general guidance (ALWAYS recommend seeing a vet for serious issues)
2. Smart Booking Assist: Help customers find and book services
3. Customer Support: Answer questions about services, orders, bookings, and platform features
4. Shopping: Help with product recommendations and orders

INTENT CLASSIFICATION:
Analyze the user's message and determine the INTENT from:
- 'symptoms': Pet health symptoms or medical questions
- 'booking': Service booking requests
- 'support': General support questions
- 'shopping': Product inquiries
- 'adoption': Pet adoption questions
- 'knowledge': General pet care knowledge
- 'general': Other queries

OUTPUT FORMAT:
Respond with a VALID JSON object ONLY:
{
  "response": "Your helpful response text here...",
  "intent": "detected_intent",
  "confidence": 0.95,
  "suggestedActions": ["action1", "action2"],
  "requiresAgent": false
}

IMPORTANT RULES:
- For symptoms: Always advise seeing a vet for serious issues, never diagnose
- For booking: Guide users to the booking flow
- For support: Provide helpful information or escalate to agent if needed
- If confidence < 0.7 or user requests human agent, set requiresAgent: true
- If they ask to **raise/open/create a ticket** or speak to a **human/agent**, set **requiresAgent: true** and reassure them the chat can be **passed to support** — do not say you cannot open a ticket from chat; point them to **Help & Support** to follow up.`;

      const vendorSystemPrompt = `You are the Warmpawz AI Assistant for **vendors** (pet care providers using the Warmpawz vendor app / dashboard).

ROLE: Help providers manage their business on Warmpawz — services, schedule/bookings, earnings and settlements, profile and settings, and how to contact platform support. Do NOT tell them to use customer-only flows like "Symptoms" or "Booking" tabs in the consumer app unless they are asking as a pet owner.

CONTEXT:
${vendorContext ? `- ${vendorContext}\n` : ''}${vendorProfileBlock ? `${vendorProfileBlock}\n` : ''}${bookingContext ? `- ${bookingContext}\n` : ''}${storeContext ? `- ${storeContext}\n` : ''}${transcriptHint}

CAPABILITIES (vendor):
1. Services: Adding/editing services, pricing, availability, service catalog vs custom services (solo vs business)
2. Bookings: Dashboard schedule, confirming visits, status updates, customer communication
3. Payments & settlements: Earnings, payouts, reporting — give high-level guidance; never fabricate account numbers or amounts
4. Support: How to reach Warmpawz support for disputes or account issues

INTENT CLASSIFICATION (vendor):
Use intents such as: 'vendor_services', 'vendor_bookings', 'vendor_payouts', 'vendor_support', 'general'.

OUTPUT FORMAT:
Respond with a VALID JSON object ONLY:
{
  "response": "Your helpful response text here...",
  "intent": "detected_intent",
  "confidence": 0.95,
  "suggestedActions": ["action1", "action2"],
  "requiresAgent": false
}

IMPORTANT RULES:
- Be concise and actionable; reference app areas: Bookings tab, Settings, Reporting, Services
- **Support handoff:** If they ask for a **human**, **live agent**, or to **raise/open/create/file/log a support ticket** (or "can you open a ticket"), set **requiresAgent: true** in your JSON. The **Warmpawz platform records this chat for the support team** when handoff is triggered — **do not** say you are unable to open or raise a ticket from chat; say their request is **flagged for support** and they should use **Support** / **Help** in the vendor app to track it. Never paste a full ticket UUID in "response".
- If the user needs human help (payout disputes, account lock), set requiresAgent: true
- If confidence < 0.7 or they ask for a human, set requiresAgent: true
${vendorAiSuffix ? `\nOPERATOR / TENANT-SPECIFIC INSTRUCTIONS (must follow when relevant):\n${vendorAiSuffix}\n` : ''}`;

      const systemPrompt = isVendorSession ? vendorSystemPrompt : customerSystemPrompt;

      const customerBedrockOpts = { maxTokens: 1024, temperature: 0.5, topP: 0.9 } as const;
      const bedrockOpts = isVendorSession ? vendorBedrockOpts : customerBedrockOpts;

      let responseText = '';
      let intent = 'general';
      let confidence = 0.5;
      let suggestedActions: string[] = [];
      let requiresAgent = false;
      let usedBedrock = false;

      // Try AWS Bedrock with retry. If invoke succeeds, we must set usedBedrock=true even when
      // parsing yields plain text — otherwise the rule fallback overwrites the model output (e.g. canned "hi").
      let bedrockCompletion: string | null = null;
      let guardrailBlocked = false;
      try {
        bedrockCompletion = await withRetry(
          () =>
            invokeBedrock(message, systemPrompt, {
              maxTokens: bedrockOpts.maxTokens,
              temperature: bedrockOpts.temperature,
              topP: bedrockOpts.topP,
            }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );
      } catch (err: unknown) {
        if ((err as Error)?.message === BEDROCK_GUARDRAIL_BLOCKED) {
          logErrorSafe('ai-chatbot-chat', { name: 'Guardrail', message: 'blocked' });
          guardrailBlocked = true;
        } else {
          logErrorSafe('ai-chatbot-chat-bedrock', err);
        }
      }

      if (guardrailBlocked) {
        usedBedrock = true;
        responseText = GUARDRAIL_CHAT_FALLBACK;
        intent = 'general';
        confidence = 0.85;
        suggestedActions = ['Contact Support', 'Create Ticket'];
      } else if (bedrockCompletion != null) {
        usedBedrock = true;
        const parsed = parseChatBedrockCompletion(bedrockCompletion);
        responseText = parsed.responseText || bedrockCompletion.slice(0, 12000);
        intent = parsed.intent;
        confidence = parsed.confidence;
        suggestedActions = parsed.suggestedActions;
        requiresAgent = parsed.requiresAgent;
      }

      // Fallback to rule-based responses only when Bedrock did not return a completion
      if (!usedBedrock) {
        const lowerMessage = message.toLowerCase();

        if (isVendorSession) {
          if (
            /\b(service|services|catalog|pricing|manage my services|add service|edit service|what i offer)\b/.test(
              lowerMessage
            )
          ) {
            intent = 'vendor_services';
            responseText =
              'To **manage services**, use **Settings** and your **Services** section from the vendor dashboard. There you can add or edit what you offer, set availability, and update pricing. Solo providers manage custom services there; business locations may use the catalog tied to your center.';
            confidence = 0.88;
            suggestedActions = ['Open Services', 'Settings'];
          } else if (
            /\b(booking|bookings|appointment|appointments|schedule|calendar|today)\b/.test(lowerMessage)
          ) {
            intent = 'vendor_bookings';
            responseText =
              'Use the **Bookings** tab on your dashboard to see your schedule, open a booking for details, update status, and message the customer. You can complete or start services from the appointment card when supported.';
            confidence = 0.88;
            suggestedActions = ['Bookings', 'Dashboard'];
          } else if (
            /\b(payment|payout|payouts|settlement|settlements|earning|earnings|razorpay|bank|payout history)\b/.test(
              lowerMessage
            )
          ) {
            intent = 'vendor_payouts';
            responseText =
              'For **payments and settlements**, open **Reporting** on your dashboard for earnings summaries, and check **Settings** for payout / bank details (labels may vary by app version). For a missing payout or dispute, use **Contact support** and include dates and booking references.';
            confidence = 0.85;
            suggestedActions = ['Reporting', 'Contact support'];
          } else if (
            /\b(contact support|support team|help desk|human agent|live agent|real person|talk to someone|speak to (a )?human)\b/.test(
              lowerMessage
            ) ||
            /\b(raise|open|file|create|log|start)\s+(a\s+)?(support\s+)?ticket\b/.test(lowerMessage) ||
            /\b(raise|open|create)\s+(a\s+)?(case|support\s+case)\b/.test(lowerMessage) ||
            (/\bcan\s+you\s+(raise|open|create|file|log)\b/.test(lowerMessage) && /\bticket\b/.test(lowerMessage)) ||
            /\bneed\s+(a\s+)?(support\s+)?ticket\b/.test(lowerMessage)
          ) {
            intent = 'vendor_support';
            responseText =
              'Reach Warmpawz support from **Help** or **Contact support** in the vendor app. Include your business name and a short summary of the issue for faster help.';
            confidence = 0.88;
            suggestedActions = ['Contact Support'];
            requiresAgent = true;
          } else if (/\b(hi|hello|hey|hii)\b/.test(lowerMessage) && lowerMessage.length < 40) {
            intent = 'general';
            responseText =
              "Hi! I'm the Warmpawz vendor assistant. Ask about **services**, **bookings**, **payments & settlements**, or **contact support** for account issues.";
            confidence = 0.9;
            suggestedActions = ['Services', 'Bookings', 'Reporting'];
          } else if (/\b(help)\b/.test(lowerMessage)) {
            intent = 'vendor_support';
            responseText =
              'I can help with **services**, **bookings**, **payments**, and **settings**. Say what you are trying to do (e.g. add a service, check a booking, or a payout question), or use **Contact support** for account-specific problems.';
            confidence = 0.84;
            suggestedActions = ['Services', 'Bookings', 'Contact support'];
          } else {
            intent = 'support';
            responseText =
              "I'm not sure I understood. Try asking about **services**, **bookings**, **payments & settlements**, or **contact support**. You can also tap a quick question in the chat.";
            // Below 0.7 so a support ticket is created (same low-confidence handoff as customer path).
            confidence = 0.68;
            suggestedActions = ['Services', 'Bookings', 'Contact support'];
          }
        } else if (
          lowerMessage.includes('symptom') ||
          lowerMessage.includes('sick') ||
          lowerMessage.includes('ill') ||
          lowerMessage.includes('vomit') ||
          lowerMessage.includes('diarrhea') ||
          lowerMessage.includes('fever')
        ) {
          intent = 'symptoms';
          responseText =
            "I understand you're concerned about your pet's health. While I can provide general guidance, it's important to consult with a veterinarian for proper diagnosis and treatment. Would you like me to help you find a nearby vet clinic or book a consultation?";
          confidence = 0.8;
          suggestedActions = ['Find Vet Clinic', 'Book Consultation'];
        } else if (lowerMessage.includes('book') || lowerMessage.includes('appointment') || lowerMessage.includes('schedule')) {
          intent = 'booking';
          responseText =
            "I'd be happy to help you book a service! What type of service are you looking for? (e.g., Vet consultation, Grooming, Training, etc.)";
          confidence = 0.85;
          suggestedActions = ['Browse Services', 'Book Now'];
        } else if (
          lowerMessage.includes('order') ||
          lowerMessage.includes('product') ||
          lowerMessage.includes('buy') ||
          lowerMessage.includes('shop')
        ) {
          intent = 'shopping';
          responseText =
            'I can help you with shopping! You can browse our products in the Shop section. What are you looking for?';
          confidence = 0.8;
          suggestedActions = ['Browse Shop', 'View Cart'];
        } else if (
          (/\b(where|location|address|located|locat|near|nearby|area|city)\b/.test(lowerMessage) &&
            /\b(you|warmpawz|clinic|vet|office|center|centre|store|shop|based|hq|head)\b/.test(lowerMessage)) ||
          (/\bwhere\b/.test(lowerMessage) && /\blocat/.test(lowerMessage))
        ) {
          intent = 'knowledge';
          responseText =
            'Warmpawz lists pet care providers (vets, groomers, and more) in the app — we do not have a single physical storefront. Open Search or Vet Care to find clinics and book a provider near you.';
          confidence = 0.88;
          suggestedActions = ['Find Vet Clinic', 'Search Providers'];
        } else if (
          /\b(change|update|edit|correct|wrong)\b/.test(lowerMessage) &&
          /\b(name|profile|account|phone|email)\b/.test(lowerMessage)
        ) {
          intent = 'support';
          responseText =
            'You can update your profile details from the Profile / Settings section. Open Profile from the bottom menu, then edit your name or contact information.';
          confidence = 0.88;
          suggestedActions = ['Open Settings'];
        } else if (/\b(hi|hello|hey|hii)\b/.test(lowerMessage) && lowerMessage.length < 40) {
          intent = 'general';
          responseText =
            "Hi! I'm the Warmpawz assistant. Ask me about pet care, bookings, or symptoms — or use the **Symptoms** and **Booking** tabs above for guided help.";
          confidence = 0.9;
          suggestedActions = ['Create Ticket', 'Contact Support'];
        } else if (/\b(help|support|agent|human|talk to someone)\b/.test(lowerMessage)) {
          intent = 'support';
          responseText =
            'I can help with common questions here. For account or order issues, contact our support team from Help & Support.';
          confidence = 0.85;
          suggestedActions = ['Create Ticket', 'Contact Support'];
        } else {
          intent = 'support';
          responseText =
            "I'm not sure I understood that. Try rephrasing, or use **Symptoms** for health concerns and **Booking** to find a service. You can also search providers or contact support.";
          confidence = 0.72;
          suggestedActions = ['Create Ticket', 'Contact Support', 'Search Providers'];
        }
      }

      /** Escalation only runs when requiresAgent or confidence < 0.7 — catch ticket/human phrasing the model missed. */
      if (!requiresAgent) {
        const lm = String(message || '').toLowerCase();
        const wantsTicketOrHuman =
          /\b(raise|open|file|create|log|start)\s+(a\s+)?(support\s+)?ticket\b/.test(lm) ||
          /\b(raise|open|create)\s+(a\s+)?(case|support\s+case)\b/.test(lm) ||
          (/\bcan\s+you\s+(raise|open|create|file|log)\b/.test(lm) && /\bticket\b/.test(lm)) ||
          /\bneed\s+(a\s+)?(support\s+)?ticket\b/.test(lm) ||
          /\bi\s+need\s+(a\s+)?human\b/.test(lm) ||
          /\btalk\s+to\s+(a\s+)?human\b/.test(lm) ||
          /\bspeak\s+to\s+(a\s+)?human\b/.test(lm) ||
          /\b(contact|get)\s+(a\s+)?(human|agent|real\s+person)\b/.test(lm);
        if (wantsTicketOrHuman) {
          requiresAgent = true;
          if (isVendorSession && (intent === 'general' || intent === 'support')) {
            intent = 'vendor_support';
          }
        }
      }

      // Only fill defaults when Bedrock did not supply actions (avoid stomping model JSON).
      if (!isVendorSession && widgetMode === 'chat') {
        if (!usedBedrock || !Array.isArray(suggestedActions) || suggestedActions.length === 0) {
          suggestedActions = ['Create Ticket', 'Contact Support'];
        }
      }

      let escalationTicketId: string | undefined;
      let escalationTicketCreated = false;
      let escalationCapReached = false;
      if (requiresAgent || confidence < 0.7) {
        try {
          const ensured = await ensureEscalationTicket({
            conversationId: currentConversationId,
            customerId: !isVendorSession ? customerId || null : null,
            customerPhone: !isVendorSession ? customerPhone || null : null,
            vendorId: isVendorSession && effectiveVendorId ? effectiveVendorId : null,
            subject: `AI Chatbot Handoff - ${intent}`,
            message: `User: ${redactForLog(String(message), 800)}\n\nAI Response: ${redactForLog(responseText, 800)}\n\nIntent: ${intent}, Confidence: ${confidence}${effectiveVendorId ? `\nVendorId: ${effectiveVendorId}` : ''}`,
            priority: 'medium',
            intent,
            confidence,
            escalationReason: requiresAgent ? 'Bot flagged requiresAgent' : 'Low confidence handoff',
          });
          if (ensured.ticketId) {
            escalationTicketId = ensured.ticketId;
            escalationTicketCreated = ensured.created;
          }
          if (ensured.capReached) {
            escalationCapReached = true;
            responseText = `${responseText}\n\nSupport already has your recent requests from this chat; we will not open duplicate tickets.`.trim();
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-escalation-ticket', e);
        }
      }

      if (escalationTicketId && !escalationCapReached) {
        responseText = appendSupportTicketAckToResponse(responseText, {
          ticketId: escalationTicketId,
          created: escalationTicketCreated,
          capReached: escalationCapReached,
          isVendorSession,
        });
      }

      try {
        await insert('ai_chatbot_conversations', {
          conversation_id: currentConversationId,
          customer_id: !isVendorSession ? customerId || null : null,
          customer_phone: !isVendorSession ? customerPhone || null : null,
          user_message: message,
          bot_response: responseText,
          intent,
          confidence,
          requires_agent: requiresAgent,
          created_at: new Date().toISOString(),
        }).catch(() => {
          // Graceful fallback if table doesn't exist
        });
      } catch (e) {
        logErrorSafe('ai-chatbot-save-conversation', e);
      }

      return c.json({
        success: true,
        conversationId: currentConversationId,
        response: responseText,
        intent,
        confidence,
        suggestedActions,
        requiresAgent,
        usedBedrock,
        ticketId: escalationTicketId,
        escalationTicketCreated,
        escalationCapReached,
      });
    } catch (error: unknown) {
      logErrorSafe('ai-chatbot-chat-handler', error);
      const msg = (error as Error)?.message || 'Failed to process chat message';
      return c.json({ error: redactForLog(msg, 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/symptoms-checker
   * Dedicated symptoms checker endpoint
   */
  app.post("/ai-chatbot/symptoms-checker", async (c) => {
    try {
      const { symptoms, petId, petType, petAge, customerId, customerPhone } = await c.req.json();

      if (!symptoms) {
        return c.json({ error: 'symptoms are required' }, 400);
      }

      // Fetch pet context
      let petContext = '';
      if (petId) {
        try {
          const pets = await select('pets', { id: petId });
          if (pets.length > 0) {
            const pet = pets[0];
            petContext = `Pet: ${pet.name || 'Unknown'}, Type: ${pet.pet_type || petType || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || petAge || 'Unknown'}`.slice(
              0,
              200
            );
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-symptoms-pet', e);
        }
      }

      const systemPrompt = `You are a **symptom triage assistant** on the **Warmpawz** app. This tab is **information only**: you **do not** name, recommend, or suggest specific doctors, clinics, or providers.

RULES:
1. **Reason** with the pet parent: what the signs might mean in plain language (possibilities, not a definitive diagnosis), what to watch for, and **how serious** it may be.
2. **Never** diagnose definitively, prescribe medication or doses, or replace an in-person exam.
3. **Urgency**: "immediate" = emergency / do not delay; "soon" = vet often needed same day or next day; "routine" = lower concern but may still need a visit.
4. **No provider suggestions in this tab.** Do not tell them to pick a named clinic here. If they need professional care, say they should use the app’s **Booking** tab to find and book a veterinarian (you may mention that path in text).
5. When the situation is **serious** (urgency "immediate" or "soon", or clear red flags), set **vetBookingSuggested** to **true** and clearly tell them to **open the Booking section** of this assistant to book care — and for true emergencies, tell them to go to an ER or clinic now. When it is milder, **vetBookingSuggested** can be false.
6. Tone: calm, empathetic, concise.

CONTEXT:
${petContext ? `- ${petContext}\n` : ''}

OUTPUT FORMAT (JSON only):
{
  "response": "Your reasoning and guidance (markdown ok).",
  "possibleCauses": ["non-definitive possibilities"],
  "urgency": "immediate" | "soon" | "routine",
  "recommendations": ["safe next steps"],
  "shouldSeeVet": true,
  "vetBookingSuggested": false
}`;

      const symptomsForModel = String(symptoms).trim();

      let analysis;
      try {
        const completion = await withRetry(
          () => invokeBedrock(symptomsForModel, systemPrompt, {
            maxTokens: 1024,
            temperature: 0.35,
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );
        analysis = parseSymptomsBedrockCompletion(completion);
      } catch (err: unknown) {
        if ((err as Error)?.message === BEDROCK_GUARDRAIL_BLOCKED) {
          logErrorSafe('ai-chatbot-symptoms', { name: 'Guardrail', message: 'blocked' });
          analysis = {
            response:
              'We could not complete automated triage for this wording due to safety filters. Try shorter, neutral phrasing (signs and duration only), or speak with a veterinarian.',
            possibleCauses: [],
            urgency: 'routine',
            recommendations: ['Consult with a veterinarian'],
            shouldSeeVet: true,
            vetBookingSuggested: false,
          };
        } else {
          logErrorSafe('ai-chatbot-symptoms-bedrock', err);
          analysis = parseSymptomsBedrockCompletion('');
        }
      }

      analysis.vetBookingSuggested =
        analysis.vetBookingSuggested === true ||
        analysis.urgency === 'immediate' ||
        analysis.urgency === 'soon';

      const bookingUrl = normalizeCustomerBookingUrl('vet', String(symptoms).trim());

      // Save symptoms check
      try {
        await insert('symptoms_checks', {
          customer_id: customerId || null,
          customer_phone: customerPhone || null,
          pet_id: petId || null,
          symptoms,
          analysis: JSON.stringify(analysis),
          created_at: new Date().toISOString(),
        }).catch(() => {
          // Graceful fallback
        });
      } catch (e) {
        logErrorSafe('ai-chatbot-save-symptoms', e);
      }

      return c.json({
        success: true,
        ...analysis,
        bookingUrl,
      });
    } catch (error: unknown) {
      logErrorSafe('ai-chatbot-symptoms-handler', error);
      const msg = (error as Error)?.message || 'Failed to analyze symptoms';
      return c.json({ error: redactForLog(msg, 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/booking-assist
   * Smart booking assistance
   */
  app.post("/ai-chatbot/booking-assist", async (c) => {
    try {
      const { query: bookingQuery, customerId, customerPhone, location, petId } = await c.req.json();

      if (!bookingQuery) {
        return c.json({ error: 'query is required' }, 400);
      }

      let resolvedLat: number | null = null;
      let resolvedLng: number | null = null;
      const fromClient = parseLocationFromBody(location);
      if (fromClient) {
        resolvedLat = fromClient.lat;
        resolvedLng = fromClient.lng;
      } else {
        const cc = await getCustomerCoordinates(customerPhone ?? null, customerId ?? null);
        if (cc) {
          resolvedLat = cc.latitude;
          resolvedLng = cc.longitude;
        }
      }

      const nearbyCategory = resolveNearbyBookingCategory(String(bookingQuery));
      let nearbyRows: NearbyBookingVendorRow[] = [];
      if (resolvedLat != null && resolvedLng != null && nearbyCategory) {
        try {
          nearbyRows = await lookupNearbyBookingVendors(resolvedLat, resolvedLng, nearbyCategory);
        } catch (e) {
          logErrorSafe('ai-chatbot-booking-nearby', e);
        }
      }

      const nearbyPromptBlock =
        nearbyRows.length > 0
          ? `NEARBY PROVIDERS (from live catalog; distances in km — reference only these names, do not invent others):\n${nearbyRows
              .slice(0, 8)
              .map((v) => `- ${v.businessName}${v.city ? `, ${v.city}` : ''} (~${v.distanceKm} km)`)
              .join('\n')}\n`
          : '';

      const locationPromptLine =
        resolvedLat != null && resolvedLng != null
          ? `- Customer approximate coordinates (for context only): ${resolvedLat.toFixed(3)}, ${resolvedLng.toFixed(3)}\n`
          : '';

      // Fetch available services
      let servicesContext = '';
      try {
        const services = await query(
          `SELECT id, name, service_style, role_id 
           FROM services 
           WHERE is_active = true 
           ORDER BY created_at DESC 
           LIMIT 12`
        );
        if (services.rows && services.rows.length > 0) {
          servicesContext = `Available Services:\n${services.rows
            .map((s: any) => `- ${String(s.name || '').slice(0, 72)} (${s.service_style || 'general'})`)
            .join('\n')}`.slice(0, 2000);
        }
      } catch (e) {
        logErrorSafe('ai-chatbot-booking-services', e);
      }

      const systemPrompt = `You are a booking assistant for Warmpawz pet services platform.

CONTEXT:
${servicesContext ? `- ${servicesContext}\n` : ''}${locationPromptLine}${nearbyPromptBlock}

RULES:
- Do **not** invent real clinic or business names. Only reference providers listed under NEARBY PROVIDERS above (if any).
- If NEARBY PROVIDERS is empty, do **not** claim you found geocoded or numbered clinics; say the app can list **bookable partners** you can tap below or use Search / Booking.
- Keep "response" concise; the app may append provider lists separately.

TASK:
1. Understand the user's booking request OR booking problem (e.g. unable to book, payment failed)
2. Identify the service type they need (if mentioned)
3. Suggest appropriate services when they want a new booking
4. Guide them to the booking flow OR troubleshooting (view bookings, contact support)

If the user describes a **booking problem** (not a new booking request), use a troubleshooting tone, set **"assistIntent": "trouble"**, and do **not** put their error message into bookingUrl.

OUTPUT FORMAT (JSON only):
{
  "response": "Your helpful booking guidance...",
  "suggestedServices": ["service1", "service2"],
  "serviceType": "vet" | "grooming" | "training" | "boarding" | "other",
  "assistIntent": "trouble" | "discover",
  "nextSteps": ["step1", "step2"],
  "bookingUrl": "/book?service=..."
}`;

      let assistance;
      try {
        const completion = await withRetry(
          () => invokeBedrock(bookingQuery, systemPrompt, {
            maxTokens: 512,
            temperature: 0.6,
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );
        assistance = parseBookingAssistBedrockCompletion(completion);
      } catch (err: unknown) {
        if ((err as Error)?.message === BEDROCK_GUARDRAIL_BLOCKED) {
          logErrorSafe('ai-chatbot-booking', { name: 'Guardrail', message: 'blocked' });
        } else {
          logErrorSafe('ai-chatbot-booking-bedrock', err);
        }
        assistance = parseBookingAssistBedrockCompletion('');
      }

      let catalogServices: Array<{ id: string; name: string; serviceStyle?: string }> = [];
      let catalogVendors: Array<{ id: string; businessName: string; city?: string }> = [];
      try {
        const ctx = await lookupBookingContext(bookingQuery);
        catalogServices = ctx.services;
        catalogVendors = ctx.vendors;
        if (catalogServices.length > 0 || catalogVendors.length > 0) {
          assistance.response = appendBookingContextToResponse(
            assistance.response || '',
            catalogServices,
            catalogVendors
          );
          if (!assistance.suggestedServices?.length && catalogServices.length > 0) {
            assistance.suggestedServices = catalogServices.map((s) => s.name);
          }
        }
      } catch (e) {
        logErrorSafe('ai-chatbot-booking-catalog', e);
      }

      const effectiveCat = resolveEffectiveBookingCategory(
        String(bookingQuery),
        nearbyCategory,
        String(assistance.serviceType || '')
      );

      let nearbyRowsFinal = nearbyRows;
      if (resolvedLat != null && resolvedLng != null && effectiveCat) {
        const needRefetch =
          nearbyRowsFinal.length === 0 ||
          nearbyCategory !== effectiveCat;
        if (needRefetch) {
          try {
            const r2 = await lookupNearbyBookingVendors(resolvedLat, resolvedLng, effectiveCat);
            nearbyRowsFinal = r2;
          } catch (e) {
            logErrorSafe('ai-chatbot-booking-nearby-refetch', e);
          }
        }
      }

      if (nearbyRowsFinal.length > 0) {
        assistance.response = appendNearbyBookingProvidersToResponse(assistance.response || '', nearbyRowsFinal);
      }

      const st = String(assistance.serviceType || '').toLowerCase();
      const inferredIntent = inferBookingAssistIntentFromText(String(bookingQuery));
      const modelIntent = String((assistance as { assistIntent?: string }).assistIntent || '')
        .toLowerCase()
        .trim();
      const assistIntent: 'trouble' | 'discover' =
        modelIntent === 'trouble' || modelIntent === 'discover' ? modelIntent : inferredIntent;

      const normalizedUrl = normalizeCustomerBookingUrl(
        effectiveCat || (BOOKING_SEARCH_CATEGORY_SET.has(st) ? st : '') || '',
        assistIntent === 'trouble' ? '' : String(bookingQuery)
      );
      if (
        !assistance.bookingUrl ||
        assistance.bookingUrl === '/book' ||
        !String(assistance.bookingUrl).startsWith('/')
      ) {
        assistance.bookingUrl = normalizedUrl;
      } else if (assistIntent === 'trouble') {
        assistance.bookingUrl = normalizedUrl;
      }

      if (!assistance.nextSteps?.length) {
        assistance.nextSteps =
          assistIntent === 'trouble'
            ? ['View my bookings', 'Contact support']
            : ['Continue to booking', 'Browse Services'];
      } else if (assistIntent === 'trouble') {
        assistance.nextSteps = assistance.nextSteps.filter(
          (step) => !/^check available services$/i.test(String(step).trim())
        );
        if (assistance.nextSteps.length === 0) {
          assistance.nextSteps = ['View my bookings', 'Contact support'];
        }
      }

      let suggestedProviders: Array<{
        id: string;
        businessName: string;
        city?: string;
        roleName?: string;
        distanceKm?: number;
      }> =
        nearbyRowsFinal.length > 0
          ? nearbyRowsFinal.map((v) => ({
              id: v.id,
              businessName: v.businessName,
              city: v.city,
              roleName: v.roleName,
              distanceKm: v.distanceKm,
            }))
          : catalogVendors.map((v) => ({
              id: v.id,
              businessName: v.businessName,
              city: v.city,
            }));

      if (suggestedProviders.length === 0 && effectiveCat) {
        try {
          const fb = await lookupVendorsBookingFallbackByCategory(effectiveCat, 8);
          if (fb.length > 0) {
            suggestedProviders = fb.map((v) => ({
              id: v.id,
              businessName: v.businessName,
              city: v.city,
              roleName: v.roleName,
            }));
            assistance.response = `${(assistance.response || '').trim()}\n\n**Book in chat** — tap a provider below to choose visit type, service, and time.`.trim();
          }
        } catch (e) {
          logErrorSafe('ai-chatbot-booking-category-fallback', e);
        }
      }

      return c.json({
        success: true,
        ...assistance,
        assistIntent,
        catalogServices,
        suggestedProviders,
      });
    } catch (error: unknown) {
      logErrorSafe('ai-chatbot-booking-handler', error);
      const msg = (error as Error)?.message || 'Failed to assist with booking';
      return c.json({ error: redactForLog(msg, 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/escalate-to-agent
   * Escalate conversation to human agent
   */
  app.post("/ai-chatbot/escalate-to-agent", async (c) => {
    try {
      const {
        conversationId,
        customerId,
        customerPhone,
        reason,
        conversationHistory,
        vendorId: vendorIdBody,
      } = await c.req.json();

      if (!conversationId) {
        return c.json({ error: 'conversationId is required' }, 400);
      }

      const ensured = await ensureEscalationTicket({
        conversationId,
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        vendorId: typeof vendorIdBody === 'string' && vendorIdBody ? vendorIdBody : null,
        subject: `AI Chatbot Escalation - ${reason || 'User Request'}`,
        message: `Conversation ID: ${conversationId}\n\nReason: ${reason || 'User requested human agent'}\n\nConversation History:\n${conversationHistory || 'N/A'}`,
        priority: 'high',
        escalationReason: reason || 'User Request',
      });

      return c.json({
        success: true,
        ticketId: ensured.ticketId,
        ticketCreated: ensured.created,
        message: 'Your conversation has been escalated to a support agent. They will contact you shortly.',
      });
    } catch (error: unknown) {
      logErrorSafe('ai-chatbot-escalate', error);
      const msg = (error as Error)?.message || 'Failed to escalate to agent';
      return c.json({ error: redactForLog(msg, 300) }, 500);
    }
  });

  /**
   * GET /ai-chatbot/conversation/:conversationId
   * Get conversation history
   */
  app.get("/ai-chatbot/conversation/:conversationId", async (c) => {
    try {
      const { conversationId } = c.req.param();

      const conversations = await query(
        `SELECT * FROM ai_chatbot_conversations 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        conversationId,
        messages: conversations.rows || [],
      });
    } catch (error: unknown) {
      logErrorSafe('ai-chatbot-conversation-fetch', error);
      const msg = (error as Error)?.message || 'Failed to fetch conversation';
      return c.json({ error: redactForLog(msg, 300) }, 500);
    }
  });
}

