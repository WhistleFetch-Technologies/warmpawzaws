/**
 * Bounded parsing of Bedrock model output for AI chatbot routes.
 * Only allowlisted keys influence application state (treat model output as untrusted).
 */

const MAX_RESPONSE_CHARS = 12000;
const MAX_ACTION_STRING = 80;
const MAX_ACTIONS = 8;
const MAX_INTENT_LEN = 64;

/** Intents we accept from the model; unknown values map to "general". */
const CHAT_INTENT_ALLOWLIST = new Set([
  'general',
  'symptoms',
  'booking',
  'support',
  'shopping',
  'adoption',
  'knowledge',
  'vendor_services',
  'vendor_bookings',
  'vendor_payouts',
  'vendor_support',
  'service',
  'admin_vendors',
  'admin_platform_settings',
  'admin_roles',
  'admin_governance',
]);

function clampConfidence(n: unknown): number {
  const x = typeof n === 'number' && !Number.isNaN(n) ? n : Number(n);
  if (Number.isNaN(x)) return 0.8;
  return Math.min(1, Math.max(0, x));
}

function sanitizeIntent(raw: unknown): string {
  const s = String(raw ?? 'general')
    .trim()
    .toLowerCase()
    .slice(0, MAX_INTENT_LEN)
    .replace(/[^a-z0-9_-]/g, '');
  return CHAT_INTENT_ALLOWLIST.has(s) ? s : 'general';
}

function sanitizeSuggestedActions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= MAX_ACTIONS) break;
    const t = String(item ?? '')
      .trim()
      .slice(0, MAX_ACTION_STRING);
    if (t) out.push(t);
  }
  return out;
}

export function extractFirstJsonObjectString(text: string): string | null {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

/** Models often wrap JSON in ```json fences; strip so extraction/parsing succeeds. */
function stripMarkdownCodeFence(text: string): string {
  let s = text.trim();
  if (!s.startsWith('```')) return s;
  s = s.replace(/^```[a-zA-Z0-9]*\s*\n?/, '');
  s = s.replace(/\n?```\s*$/, '').trim();
  return s;
}

export type ParsedChatFields = {
  responseText: string;
  intent: string;
  confidence: number;
  suggestedActions: string[];
  requiresAgent: boolean;
  structured: boolean;
};

/**
 * Parse main /ai-chatbot/chat completion: prefer JSON object with allowlisted keys; else plain text.
 */
export function parseChatBedrockCompletion(completion: string): ParsedChatFields {
  const raw = String(completion ?? '').trim();
  if (!raw) {
    return {
      responseText: '',
      intent: 'general',
      confidence: 0.7,
      suggestedActions: [],
      requiresAgent: false,
      structured: false,
    };
  }

  const jsonStr = extractFirstJsonObjectString(raw);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      const responseRaw = parsed.response;
      const responseText =
        typeof responseRaw === 'string'
          ? responseRaw.trim().slice(0, MAX_RESPONSE_CHARS)
          : raw.slice(0, MAX_RESPONSE_CHARS);
      if (responseText.length > 0) {
        return {
          responseText,
          intent: sanitizeIntent(parsed.intent),
          confidence: clampConfidence(parsed.confidence),
          suggestedActions: sanitizeSuggestedActions(parsed.suggestedActions),
          requiresAgent: Boolean(parsed.requiresAgent),
          structured: true,
        };
      }
    } catch {
      /* fall through to plain text */
    }
  }

  return {
    responseText: raw.slice(0, MAX_RESPONSE_CHARS),
    intent: 'general',
    confidence: 0.7,
    suggestedActions: [],
    requiresAgent: false,
    structured: false,
  };
}

const SYMPTOM_URGENCY = new Set(['immediate', 'soon', 'routine']);

function sanitizeStringArray(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= maxItems) break;
    const t = String(item ?? '')
      .trim()
      .slice(0, maxLen);
    if (t) out.push(t);
  }
  return out;
}

export type ParsedSymptomsFields = {
  response: string;
  possibleCauses: string[];
  urgency: 'immediate' | 'soon' | 'routine';
  recommendations: string[];
  shouldSeeVet: boolean;
  vetBookingSuggested: boolean;
};

export function parseSymptomsBedrockCompletion(completion: string): ParsedSymptomsFields {
  const raw = stripMarkdownCodeFence(String(completion ?? '')).trim();
  const fallback = (): ParsedSymptomsFields => ({
    response: raw.slice(0, MAX_RESPONSE_CHARS) || 'Please consult a veterinarian for guidance.',
    possibleCauses: [],
    urgency: 'routine',
    recommendations: ['Consult with a veterinarian'],
    shouldSeeVet: true,
    vetBookingSuggested: false,
  });

  const jsonStr = extractFirstJsonObjectString(raw);
  if (!jsonStr) return fallback();

  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const urgencyRaw = String(p.urgency ?? 'routine').toLowerCase();
    const urgency = SYMPTOM_URGENCY.has(urgencyRaw)
      ? (urgencyRaw as 'immediate' | 'soon' | 'routine')
      : 'routine';
    const narrative =
      typeof p.response === 'string' ? p.response.trim().slice(0, MAX_RESPONSE_CHARS) : '';
    return {
      response:
        narrative.length > 0
          ? narrative
          : 'Please consult a veterinarian for guidance.',
      possibleCauses: sanitizeStringArray(p.possibleCauses, 12, 200),
      urgency,
      recommendations: sanitizeStringArray(p.recommendations, 12, 200),
      shouldSeeVet: p.shouldSeeVet !== false,
      vetBookingSuggested: p.vetBookingSuggested === true,
    };
  } catch {
    return fallback();
  }
}

const BOOKING_SERVICE_TYPES = new Set([
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'pharmacy',
  'cafe',
  'resort',
  'other',
]);

export type ParsedBookingAssistFields = {
  response: string;
  suggestedServices: string[];
  serviceType: string;
  nextSteps: string[];
  bookingUrl: string;
};

export function parseBookingAssistBedrockCompletion(completion: string): ParsedBookingAssistFields {
  const raw = String(completion ?? '').trim();
  const fallback = (): ParsedBookingAssistFields => ({
    response: raw.slice(0, MAX_RESPONSE_CHARS) || "I'd be happy to help you book a service.",
    suggestedServices: [],
    serviceType: 'other',
    nextSteps: ['Browse Services', 'Select Service', 'Choose Time Slot'],
    bookingUrl: '/book',
  });

  const jsonStr = extractFirstJsonObjectString(raw);
  if (!jsonStr) return fallback();

  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const st = String(p.serviceType ?? 'other').toLowerCase();
    const serviceType = BOOKING_SERVICE_TYPES.has(st) ? st : 'other';
    let bookingUrl = typeof p.bookingUrl === 'string' ? p.bookingUrl.trim().slice(0, 512) : '/book';
    if (!bookingUrl.startsWith('/')) bookingUrl = '/book';
    return {
      response:
        typeof p.response === 'string'
          ? p.response.trim().slice(0, MAX_RESPONSE_CHARS)
          : fallback().response,
      suggestedServices: sanitizeStringArray(p.suggestedServices, 20, 120),
      serviceType,
      nextSteps: sanitizeStringArray(p.nextSteps, 12, 120),
      bookingUrl,
    };
  } catch {
    return fallback();
  }
}
