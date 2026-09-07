/**
 * AI chatbot booking UI helpers (whitelist actions, visit-type keywords, session restore).
 */

import type { BookingServiceStyleKey } from '@/lib/ai-booking-wizard-category-config';
import { customerPathToScreen } from '@/lib/promotion-navigation';

/** Only these labels may render as clickable action chips. */
export const WHITELISTED_ACTION_KEYS = new Set([
  'book in chat',
  'continue to booking',
  'browse bookings',
  'view my bookings',
  'browse services',
  'try again',
  'contact support',
  'create ticket',
  'go to booking',
]);

export type BookingAssistIntent = 'trouble' | 'discover' | 'resume';

export type AiChatNavTarget =
  | { kind: 'spa'; screen: string; data?: Record<string, unknown> }
  | { kind: 'route'; path: string };

const BOOKINGS_DEST_KEYS = new Set(['bookings', 'my-bookings', 'my bookings', 'browse bookings', 'view my bookings']);

/** Search category slug → CustomerHomeWrapper screen id. */
const CATEGORY_TO_SPA: Record<string, string> = {
  vet: 'vet',
  grooming: 'grooming',
  training: 'training',
  boarding: 'boarding',
  walker: 'walker',
  pharmacy: 'pharmacy',
  resort: 'resort',
  cafe: 'cafes',
};

export function normalizeActionKey(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isWhitelistedAction(label: string): boolean {
  return WHITELISTED_ACTION_KEYS.has(normalizeActionKey(label));
}

/** Match backend inferBookingCategoryFromText. */
export function inferBookingCategoryFromMessage(msg: string): string | null {
  const m = msg.toLowerCase().trim();
  if (!m) return null;
  if (/\b(grooming|groom|groomer|bath|trim|haircut)\b/.test(m)) return 'grooming';
  if (/\b(walk|walker|walking)\b/.test(m)) return 'walker';
  if (/\b(train|trainer|training|behavior|behaviourist)\b/.test(m)) return 'training';
  if (/\b(board|boarding|kennel|daycare)\b/.test(m)) return 'boarding';
  if (/\b(vet|veterinar|veterinary|doctor|clinic)\b/.test(m)) return 'vet';
  if (/\b(pharmacy|medicine|medication)\b/.test(m)) return 'pharmacy';
  if (/\b(cafe|café)\b/.test(m)) return 'cafe';
  if (/\b(resort|holiday)\b/.test(m)) return 'resort';
  return null;
}

export function parseCategoryFromBookingUrl(path: string): string | null {
  if (!path.startsWith('/search')) return null;
  try {
    const qIdx = path.indexOf('?');
    if (qIdx < 0) return null;
    const cat = new URLSearchParams(path.slice(qIdx + 1)).get('category')?.trim().toLowerCase();
    return cat && CATEGORY_TO_SPA[cat] ? cat : null;
  } catch {
    return null;
  }
}

export function inferBookingAssistIntent(
  message: string,
  options?: { forceResume?: boolean }
): BookingAssistIntent {
  if (options?.forceResume) return 'resume';
  const m = String(message || '').toLowerCase().trim();
  const troublePattern =
    /\b(unable|can't|cannot|failed|error|stuck|not working|doesn't work|won't|problem|issue|help me book)\b/;
  const bookingPattern = /\b(book|booking|payment|checkout|slot|appointment)\b/;
  if (troublePattern.test(m) && bookingPattern.test(m)) return 'trouble';
  return 'discover';
}

export function buildBookingAssistButtonActions(args: {
  intent: BookingAssistIntent;
  hasProviders: boolean;
  category?: string | null;
}): string[] {
  const { intent, hasProviders, category } = args;

  if (intent === 'resume') {
    return hasProviders ? ['Book in chat', 'Continue to booking'] : ['Continue to booking'];
  }

  if (intent === 'trouble') {
    const actions = ['View my bookings', 'Contact support'];
    if (category) actions.push('Try again');
    return actions;
  }

  if (hasProviders) {
    return ['Book in chat', 'Browse services', 'Continue to booking'];
  }
  return ['Browse services', 'Continue to booking'];
}

/** Build chip actions and non-duplicated hint bullets from API nextSteps. */
export function buildBookingAssistActionsFromResponse(args: {
  intent: BookingAssistIntent;
  hasProviders: boolean;
  category?: string | null;
  stepLabels: string[];
}): { actions: string[]; hintSteps: string[] } {
  const actions = buildBookingAssistButtonActions(args);
  const actionKeys = new Set(actions.map((a) => normalizeActionKey(a)));

  for (const step of args.stepLabels) {
    const trimmed = String(step || '').trim();
    if (!trimmed || !isWhitelistedAction(trimmed)) continue;
    const key = normalizeActionKey(trimmed);
    if (actionKeys.has(key)) continue;
    if (key === 'browse bookings' && actionKeys.has('view my bookings')) continue;
    actions.push(trimmed);
    actionKeys.add(key);
  }

  const hintSteps = args.stepLabels
    .map((s) => String(s).trim())
    .filter((s) => {
      if (!s) return false;
      if (/^browse services$/i.test(s)) return false;
      const key = normalizeActionKey(s);
      if (actionKeys.has(key)) return false;
      if (/^browse bookings$/i.test(s) && actionKeys.has('view my bookings')) return false;
      if (/^view my bookings$/i.test(s) && actionKeys.has('view my bookings')) return false;
      if (/^contact support$/i.test(s) && actionKeys.has('contact support')) return false;
      return true;
    });

  return { actions, hintSteps };
}

export function resolveAiChatNavTarget(dest: string): AiChatNavTarget {
  const d = (dest || '').trim();
  if (!d) return { kind: 'route', path: '/' };

  const key = normalizeActionKey(d);

  if (key === 'contact support' || d === 'support_help') {
    return { kind: 'spa', screen: 'support_help', data: { initialTab: 'contact' } };
  }

  if (BOOKINGS_DEST_KEYS.has(key) || d === '/bookings' || d === '/my-bookings') {
    return { kind: 'spa', screen: 'my-bookings' };
  }

  if (d.startsWith('/')) {
    const pathOnly = d.split('?')[0]?.split('#')[0] ?? d;
    if (pathOnly === '/bookings' || pathOnly === '/my-bookings') {
      return { kind: 'spa', screen: 'my-bookings' };
    }
    if (pathOnly === '/search') {
      const cat = parseCategoryFromBookingUrl(d);
      if (cat && CATEGORY_TO_SPA[cat]) {
        return { kind: 'spa', screen: CATEGORY_TO_SPA[cat] };
      }
      return { kind: 'route', path: d };
    }
    const screenFromPath = customerPathToScreen(d);
    if (screenFromPath) {
      return { kind: 'spa', screen: screenFromPath };
    }
    return { kind: 'route', path: d };
  }

  if (d === 'my-bookings' || BOOKINGS_DEST_KEYS.has(key)) {
    return { kind: 'spa', screen: 'my-bookings' };
  }

  const catKey = d.toLowerCase();
  if (CATEGORY_TO_SPA[catKey]) {
    return { kind: 'spa', screen: CATEGORY_TO_SPA[catKey] };
  }

  return { kind: 'spa', screen: d };
}

export function appendHintStepsToMessage(
  base: string,
  stepLabels: string[],
  suggestedActions?: string[]
): string {
  const body = (base || '').trim();
  const actionKeys = new Set((suggestedActions || []).map((a) => normalizeActionKey(a)));
  const hints = stepLabels
    .map((s) => String(s).trim())
    .filter((s) => {
      if (!s) return false;
      if (/^browse services$/i.test(s)) return false;
      const key = normalizeActionKey(s);
      if (actionKeys.has(key)) return false;
      if (/^browse bookings$/i.test(s) && actionKeys.has('view my bookings')) return false;
      if (/^contact support$/i.test(s) && actionKeys.has('contact support')) return false;
      return true;
    });
  if (hints.length === 0) return body;
  const bullets = hints.map((h) => `• ${h}`).join('\n');
  return body ? `${body}\n\n${bullets}` : bullets;
}

/** Match backend inferVisitStyleFromMessage — clinic / home / tele from chat text. */
export function inferVisitStyleFromText(message: string): BookingServiceStyleKey | null {
  const m = String(message || '')
    .toLowerCase()
    .trim();
  if (!m) return null;
  if (/\b(home\s*visit|at\s*home|home\s*service|visit\s*at\s*home)\b/.test(m)) {
    return 'at_home';
  }
  if (
    /\b(clinic\s*visit|in[- ]?clinic|at\s*(the\s*)?clinic|at\s*center|at\s*centre|office\s*visit|in\s*person)\b/.test(
      m
    )
  ) {
    return 'at_center';
  }
  return null;
}

export function visitStyleChangeMessage(style: BookingServiceStyleKey): string {
  if (style === 'at_home') {
    return 'Switched to **home visit**. Pick a service below, then choose a date that has openings.';
  }
  return 'Switched to **in-clinic** visit. Pick a service below, then choose a date that has openings.';
}

/** Bot lines that only guide the in-chat booking wizard (hidden after payment). */
export function isBookingWizardPickPrompt(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (isBookingThankYouMessage(t)) return false;
  return (
    /\bpick a \*\*visit type\*\*/i.test(t) ||
    /\bpick a service below\b/i.test(t) ||
    /\bpick an in-clinic\b/i.test(t) ||
    /\bpick a home-visit\b/i.test(t) ||
    /\bpick a tele\b/i.test(t) ||
    /^pick a date below\b/i.test(t) ||
    /\bthen a service, date, and time\b/i.test(t) ||
    /\bthen choose a date and time\b/i.test(t) ||
    /\bthen a date and time\./i.test(t) ||
    /\bpick a service below, then choose a date\b/i.test(t) ||
    /\buse the chips below for date and time\b/i.test(t) ||
    /\bupdated your booking draft\b/i.test(t) ||
    /\bno \*\*.+\*\* services for this provider\b/i.test(t)
  );
}

export function bookingThankYouBotContent(vendorName: string): string {
  const v = vendorName.trim() || 'your provider';
  return `**${v}**\n\nYour service is booked. Thank you!`;
}

export function isBookingThankYouMessage(content: string): boolean {
  return /\byour service is booked\. thank you!/i.test(content.trim());
}

const SESSION_TTL_MS = 30 * 60 * 1000;

export type PersistedAiChatSession = {
  savedAt: number;
  mode: 'chat' | 'symptoms' | 'booking';
  botEntry: 'choose' | 'active';
  messages: unknown[];
  conversationId: string | null;
  bookingSessionId: string | null;
  bookingDraft: unknown | null;
  wizardStep: string;
  wizardCategory: string;
  bookedVendorName: string | null;
  lastBookingUrl: string | null;
  lastBookingQuery: string;
};

export function aiChatStorageKey(customerId?: string, customerPhone?: string): string {
  const id = (customerId || customerPhone || 'guest').trim();
  return `warmpawz_ai_chat_v1_${id}`;
}

export function loadPersistedAiChatSession(
  customerId?: string,
  customerPhone?: string
): PersistedAiChatSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(aiChatStorageKey(customerId, customerPhone));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAiChatSession;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(aiChatStorageKey(customerId, customerPhone));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedAiChatSession(
  payload: PersistedAiChatSession,
  customerId?: string,
  customerPhone?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      aiChatStorageKey(customerId, customerPhone),
      JSON.stringify({ ...payload, savedAt: Date.now() })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedAiChatSession(customerId?: string, customerPhone?: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(aiChatStorageKey(customerId, customerPhone));
  } catch {
    /* ignore */
  }
}
