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
import { select, insert, update, query } from '../database/rds-connection';
import { invokeBedrock } from '../utils/bedrock-client';
import { withRetry } from '../utils/error-recovery';
import { generateSupportTicketNumber } from '../utils/support-ticket-number';

const SYMPTOM_STOPWORDS = new Set([
  'the', 'and', 'for', 'pet', 'dog', 'cat', 'puppy', 'kitten', 'has', 'have', 'been', 'with', 'from', 'that', 'this',
  'please', 'help', 'she', 'her', 'his', 'him', 'they', 'them', 'our', 'your', 'not', 'are', 'was', 'but',
]);

function symptomSearchTerms(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !SYMPTOM_STOPWORDS.has(w));
  return [...new Set(raw)].slice(0, 6);
}

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
     WHERE status IN ('open', 'in_progress')
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
 */
async function ensureEscalationTicket(
  args: EnsureEscalationTicketArgs
): Promise<{ ticketId: string; created: boolean }> {
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
    subject: args.subject,
    message: args.message,
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
  }
  return { ticketId, created: true };
}

function formatChatPreviousTurns(contextObj: Record<string, unknown>): string {
  const pm = contextObj.previousMessages;
  if (!Array.isArray(pm) || pm.length === 0) return '';
  const lines = pm
    .slice(-4)
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return '';
      const m = entry as { role?: string; content?: string };
      const role = m.role === 'assistant' ? 'Assistant' : 'User';
      const content = String(m.content || '').slice(0, 240);
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
    out.systemPromptSuffix = c.systemPromptSuffix.trim().slice(0, 4000);
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

/** Match problem-grid specializations + sample providers for symptom text (DB-backed). */
async function lookupCareForSymptoms(symptomsText: string): Promise<{
  specializations: Array<{ id: string; name: string; categoryId: string; matchedSymptom?: string }>;
  vendors: Array<{ id: string; businessName: string; city?: string; roleName?: string }>;
}> {
  const terms = symptomSearchTerms(symptomsText);
  const fallback = symptomsText.trim();
  const searchTerms = terms.length > 0 ? terms : fallback.length >= 2 ? [fallback.slice(0, 48)] : [];
  if (searchTerms.length === 0) {
    return { specializations: [], vendors: [] };
  }

  const conditions: string[] = [];
  const params: string[] = [];
  let p = 1;
  for (const t of searchTerms) {
    conditions.push(
      `(ss.symptom_name ILIKE $${p} OR ss.symptom_display_name ILIKE $${p} OR $${p + 1} = ANY(ss.symptom_keywords))`
    );
    params.push(`%${t}%`, t.toLowerCase());
    p += 2;
  }

  const specSql = `
    SELECT DISTINCT 
      sm.specialization_id,
      sm.name,
      sm.display_name,
      sm.category_id,
      sm.applicable_roles,
      ss.symptom_name as matched_symptom
    FROM specialization_master sm
    JOIN specialization_symptoms ss ON ss.specialization_id = sm.specialization_id
    WHERE sm.is_active = true 
      AND sm.show_in_problem_grid = true
      AND ss.is_active = true
      AND (${conditions.join(' OR ')})
    ORDER BY sm.display_order NULLS LAST, sm.name
    LIMIT 15
  `;

  const specRes = await query(specSql, params).catch(() => ({ rows: [] as any[] }));
  const rows = specRes.rows || [];

  const specializations = rows.map((row: any) => ({
    id: row.specialization_id,
    name: row.display_name || row.name,
    categoryId: String(row.category_id || '').toLowerCase(),
    matchedSymptom: row.matched_symptom,
  }));

  const roleNames = new Set<string>();
  for (const row of rows) {
    const ar = row.applicable_roles;
    if (Array.isArray(ar)) {
      ar.forEach((r: string) => {
        if (r) roleNames.add(String(r).toLowerCase());
      });
    } else if (typeof ar === 'string') {
      try {
        const parsed = JSON.parse(ar);
        if (Array.isArray(parsed)) {
          parsed.forEach((r: string) => {
            if (r) roleNames.add(String(r).toLowerCase());
          });
        }
      } catch {
        /* ignore */
      }
    }
    const cat = String(row.category_id || '').toLowerCase();
    if (cat === 'veterinary' || cat === 'vet') {
      ['vet_solo', 'veterinarian', 'veterinary_clinic', 'vet_clinic'].forEach((r) => roleNames.add(r));
    }
    if (cat === 'grooming') roleNames.add('groomer_solo');
    if (cat === 'training') roleNames.add('trainer_solo');
    if (cat === 'walking' || cat === 'walker') roleNames.add('walker');
  }
  if (roleNames.size === 0) {
    roleNames.add('vet_solo');
  }

  const vendorSql = `
    SELECT v.id, v.business_name, v.city, r.name as role_name
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    WHERE v.status = 'approved' AND v.is_active = true
      AND LOWER(r.name) = ANY($1::text[])
    ORDER BY v.created_at DESC
    LIMIT 12
  `;
  const roleList = [...roleNames];
  let vendRes = await query(vendorSql, [roleList]).catch(() => ({ rows: [] as any[] }));
  let vendors = (vendRes.rows || []).map((v: any) => ({
    id: v.id,
    businessName: v.business_name,
    city: v.city,
    roleName: v.role_name,
  }));

  if (vendors.length === 0) {
    vendRes = await query(
      `SELECT v.id, v.business_name, v.city, r.name as role_name
       FROM vendors v
       INNER JOIN roles r ON v.role_id = r.id
       WHERE v.status = 'approved' AND v.is_active = true
         AND LOWER(r.name) LIKE '%vet%'
       ORDER BY v.created_at DESC
       LIMIT 8`,
      []
    ).catch(() => ({ rows: [] as any[] }));
    vendors = (vendRes.rows || []).map((v: any) => ({
      id: v.id,
      businessName: v.business_name,
      city: v.city,
      roleName: v.role_name,
    }));
  }

  return { specializations, vendors };
}

function appendSymptomCareToResponse(
  baseResponse: string,
  specs: Array<{ name: string; matchedSymptom?: string }>,
  vendors: Array<{ businessName: string; city?: string }>
): string {
  const lines: string[] = [baseResponse.trim()];
  if (specs.length > 0) {
    lines.push('\n\n**Related care areas on Warmpawz**');
    specs.slice(0, 8).forEach((s) => {
      const hint = s.matchedSymptom ? ` (matched: ${s.matchedSymptom})` : '';
      lines.push(`• ${s.name}${hint}`);
    });
  }
  if (vendors.length > 0) {
    lines.push('\n**Providers you can book**');
    vendors.slice(0, 8).forEach((v) => {
      const loc = v.city ? ` — ${v.city}` : '';
      lines.push(`• ${v.businessName}${loc}`);
    });
    lines.push('\nTap **Find Vet Clinic** or open Search to pick a provider and complete booking.');
  } else if (specs.length > 0) {
    lines.push('\nUse **Find Vet Clinic** or Search to see providers for these services.');
  }
  return lines.join('\n');
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
                ? `- Specialization (summary): ${String(row.specialization).slice(0, 240)}`
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
          console.warn('Failed to fetch vendor context', e);
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
            customerContext = `Customer: ${cust.first_name || ''} ${cust.last_name || ''}, Phone: ${cust.phone || customerPhone}`;
          }
        } catch (e) {
          console.warn('Failed to fetch customer context', e);
        }
      }

      // Fetch pet context
      if (petId) {
        try {
          const pets = await select('pets', { id: petId });
          if (pets.length > 0) {
            const pet = pets[0];
            petContext = `Pet: ${pet.name || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || 'Unknown'}`;
          }
        } catch (e) {
          console.warn('Failed to fetch pet context', e);
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
             LIMIT 5`,
            [effectiveVendorId]
          );
          if (bookings.rows && bookings.rows.length > 0) {
            bookingContext = `Recent bookings for this provider: ${bookings.rows.map((b: any) => `${b.service_type} (${b.status})`).join(', ')}`;
          }
        } catch (e) {
          console.warn('Failed to fetch vendor booking context', e);
        }
      } else if (!isVendorSession && (customerId || customerPhone)) {
        try {
          const bookings = await query(
            `SELECT id, service_type, booking_date, status 
             FROM bookings 
             WHERE customer_id = $1 OR customer_phone = $2
             ORDER BY created_at DESC 
             LIMIT 3`,
            [customerId || null, customerPhone || null]
          );
          if (bookings.rows && bookings.rows.length > 0) {
            bookingContext = `Recent Bookings: ${bookings.rows.map((b: any) => `${b.service_type} (${b.status})`).join(', ')}`;
          }
        } catch (e) {
          console.warn('Failed to fetch booking context', e);
        }
      }

      // Featured products — customer chat only (vendor assistant does not need shop catalog in context)
      let storeContext = '';
      if (!isVendorSession) {
        try {
          const products = await query(
            `SELECT name, sale_price, base_price FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 5`
          );
          if (products.rows && products.rows.length > 0) {
            storeContext = `Featured Products:\n${products.rows.map((p: any) => `- ${p.name} (₹${p.sale_price || p.base_price || 0})`).join('\n')}`;
          }
        } catch (e) {
          console.warn('Failed to fetch product context', e);
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
- If confidence < 0.7 or user requests human agent, set requiresAgent: true`;

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
      // JSON.parse fails — otherwise the rule fallback overwrites the model output (e.g. canned "hi").
      let bedrockCompletion: string | null = null;
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
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
      }

      if (bedrockCompletion != null) {
        usedBedrock = true;
        try {
          const jsonMatch = bedrockCompletion.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            responseText = parsed.response || bedrockCompletion;
            intent = parsed.intent || 'general';
            confidence = parsed.confidence ?? 0.8;
            suggestedActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
            requiresAgent = !!parsed.requiresAgent;
          } else {
            responseText = bedrockCompletion;
            intent = 'general';
            confidence = 0.7;
          }
        } catch (e) {
          console.warn('Failed to parse JSON from AI response', e);
          responseText = bedrockCompletion;
          intent = 'general';
          confidence = 0.7;
        }
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
          } else if (/\b(contact support|support team|help desk|human agent|talk to someone)\b/.test(lowerMessage)) {
            intent = 'vendor_support';
            responseText =
              'Reach Warmpawz support from **Help** or **Contact support** in the vendor app. Include your business name and a short summary of the issue for faster help.';
            confidence = 0.88;
            suggestedActions = ['Contact Support'];
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
            confidence = 0.75;
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

      if (!isVendorSession && widgetMode === 'chat') {
        suggestedActions = ['Create Ticket', 'Contact Support'];
      }

      // Save conversation to database
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
        console.warn('Failed to save conversation', e);
      }

      let escalationTicketId: string | undefined;
      let escalationTicketCreated = false;
      if (requiresAgent || confidence < 0.7) {
        try {
          const ensured = await ensureEscalationTicket({
            conversationId: currentConversationId,
            customerId: !isVendorSession ? customerId || null : null,
            customerPhone: !isVendorSession ? customerPhone || null : null,
            vendorId: isVendorSession && effectiveVendorId ? effectiveVendorId : null,
            subject: `AI Chatbot Handoff - ${intent}`,
            message: `User: ${message}\n\nAI Response: ${responseText}\n\nIntent: ${intent}, Confidence: ${confidence}${effectiveVendorId ? `\nVendorId: ${effectiveVendorId}` : ''}`,
            priority: 'medium',
            intent,
            confidence,
            escalationReason: requiresAgent ? 'Bot flagged requiresAgent' : 'Low confidence handoff',
          });
          if (ensured.ticketId) {
            escalationTicketId = ensured.ticketId;
            escalationTicketCreated = ensured.created;
          }
        } catch (e) {
          console.warn('Failed to create/link escalation ticket', e);
        }
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
      });
    } catch (error: any) {
      console.error('Error in AI chatbot:', error);
      return c.json({ error: error.message || 'Failed to process chat message' }, 500);
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
            petContext = `Pet: ${pet.name || 'Unknown'}, Type: ${pet.pet_type || petType || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || petAge || 'Unknown'}`;
          }
        } catch (e) {
          console.warn('Failed to fetch pet context', e);
        }
      }

      const systemPrompt = `You are a pet health assistant. Your role is to:
1. Analyze pet symptoms provided by the owner
2. Provide general guidance and possible causes
3. ALWAYS recommend consulting a veterinarian for proper diagnosis
4. NEVER provide a definitive diagnosis
5. Suggest urgency level (immediate, soon, routine)

CONTEXT:
${petContext ? `- ${petContext}\n` : ''}

OUTPUT FORMAT (JSON only):
{
  "response": "Your analysis and guidance...",
  "possibleCauses": ["cause1", "cause2"],
  "urgency": "immediate" | "soon" | "routine",
  "recommendations": ["rec1", "rec2"],
  "shouldSeeVet": true,
  "vetBookingSuggested": true
}`;

      let analysis;
      try {
        const completion = await withRetry(
          () => invokeBedrock(symptoms, systemPrompt, {
            maxTokens: 1024,
            temperature: 0.3, // Lower temperature for medical advice
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );

        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = {
            response: completion,
            possibleCauses: [],
            urgency: 'routine',
            recommendations: ['Consult with a veterinarian'],
            shouldSeeVet: true,
            vetBookingSuggested: true,
          };
        }
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
        // Fallback response
        analysis = {
          response: "I understand you're concerned about your pet's symptoms. It's important to consult with a veterinarian for proper diagnosis and treatment. Would you like me to help you find a nearby vet clinic?",
          possibleCauses: [],
          urgency: 'routine',
          recommendations: ['Consult with a veterinarian', 'Monitor symptoms', 'Keep pet comfortable'],
          shouldSeeVet: true,
          vetBookingSuggested: true,
        };
      }

      let matchedSpecs: Array<{ id: string; name: string; categoryId: string; matchedSymptom?: string }> = [];
      let matchedVendors: Array<{ id: string; businessName: string; city?: string; roleName?: string }> = [];
      try {
        const care = await lookupCareForSymptoms(symptoms);
        matchedSpecs = care.specializations;
        matchedVendors = care.vendors;
        if (matchedSpecs.length > 0 || matchedVendors.length > 0) {
          analysis.response = appendSymptomCareToResponse(analysis.response || '', matchedSpecs, matchedVendors);
        }
      } catch (e) {
        console.warn('Symptom catalog lookup failed', e);
      }

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
        console.warn('Failed to save symptoms check', e);
      }

      return c.json({
        success: true,
        ...analysis,
        matchedServices: matchedSpecs.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId })),
        suggestedProviders: matchedVendors,
      });
    } catch (error: any) {
      console.error('Error in symptoms checker:', error);
      return c.json({ error: error.message || 'Failed to analyze symptoms' }, 500);
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

      // Fetch available services
      let servicesContext = '';
      try {
        const services = await query(
          `SELECT id, name, service_style, role_id 
           FROM services 
           WHERE is_active = true 
           ORDER BY created_at DESC 
           LIMIT 20`
        );
        if (services.rows && services.rows.length > 0) {
          servicesContext = `Available Services:\n${services.rows.map((s: any) => `- ${s.name} (${s.service_style || 'general'})`).join('\n')}`;
        }
      } catch (e) {
        console.warn('Failed to fetch services context', e);
      }

      const systemPrompt = `You are a booking assistant for Warmpawz pet services platform.

CONTEXT:
${servicesContext ? `- ${servicesContext}\n` : ''}${location ? `- Location: ${location}\n` : ''}

TASK:
1. Understand the user's booking request
2. Identify the service type they need
3. Suggest appropriate services
4. Guide them to the booking flow

OUTPUT FORMAT (JSON only):
{
  "response": "Your helpful booking guidance...",
  "suggestedServices": ["service1", "service2"],
  "serviceType": "vet" | "grooming" | "training" | "boarding" | "other",
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

        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          assistance = JSON.parse(jsonMatch[0]);
        } else {
          assistance = {
            response: completion,
            suggestedServices: [],
            serviceType: 'other',
            nextSteps: ['Browse Services', 'Select Service', 'Choose Time Slot'],
            bookingUrl: '/book',
          };
        }
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
        assistance = {
          response: "I'd be happy to help you book a service! What type of service are you looking for?",
          suggestedServices: [],
          serviceType: 'other',
          nextSteps: ['Browse Services', 'Select Service', 'Choose Time Slot'],
          bookingUrl: '/book',
        };
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
        console.warn('Booking catalog lookup failed', e);
      }

      const st = String(assistance.serviceType || '').toLowerCase();
      const normalizedUrl = normalizeCustomerBookingUrl(st, bookingQuery);
      if (!assistance.bookingUrl || assistance.bookingUrl === '/book' || !String(assistance.bookingUrl).startsWith('/')) {
        assistance.bookingUrl = normalizedUrl;
      }
      if (!assistance.nextSteps?.length) {
        assistance.nextSteps = ['Continue to booking', 'Browse Services'];
      }

      return c.json({
        success: true,
        ...assistance,
        catalogServices,
        suggestedProviders: catalogVendors,
      });
    } catch (error: any) {
      console.error('Error in booking assist:', error);
      return c.json({ error: error.message || 'Failed to assist with booking' }, 500);
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
    } catch (error: any) {
      console.error('Error escalating to agent:', error);
      return c.json({ error: error.message || 'Failed to escalate to agent' }, 500);
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
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      return c.json({ error: error.message || 'Failed to fetch conversation' }, 500);
    }
  });
}

