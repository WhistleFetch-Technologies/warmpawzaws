/**
 * AI chatbot booking UI helpers (whitelist actions, visit-type keywords, session restore).
 */

import type { BookingServiceStyleKey } from '@/lib/ai-booking-wizard-category-config';

/** Only these labels may render as clickable action chips. */
export const WHITELISTED_ACTION_KEYS = new Set([
  'book in chat',
  'continue to booking',
  'browse bookings',
  'browse services',
  'contact support',
  'create ticket',
  'go to booking',
]);

export function normalizeActionKey(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isWhitelistedAction(label: string): boolean {
  return WHITELISTED_ACTION_KEYS.has(normalizeActionKey(label));
}

/** Bedrock nextSteps stay in message text only — not as buttons. */
export function buildBookingAssistButtonActions(hasProviders: boolean): string[] {
  const actions = ['Continue to booking', 'Browse Bookings'];
  if (hasProviders) {
    return ['Book in chat', ...actions];
  }
  return actions;
}

export function appendHintStepsToMessage(base: string, stepLabels: string[]): string {
  const body = (base || '').trim();
  const hints = stepLabels
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0 && !/^browse services$/i.test(s));
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
  if (/\b(tele|video\s*consult|online\s*consult|virtual\s*visit|video\s*call)\b/.test(m)) {
    return 'tele';
  }
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
  if (style === 'tele') {
    return 'Switched to **tele / video** visit. Pick a service below, then choose a date that has openings.';
  }
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
