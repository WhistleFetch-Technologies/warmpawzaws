/**
 * Aggregates customer message unread counts for the home header badge:
 * vendor booking chat (from GET /chat/conversations) + support tickets (thread tail + "seen" in browser).
 */

import { apiClient, supportCrmApi } from '@/lib/api-client';

const EXCLUDED_TICKET_STATUSES = new Set(['closed', 'cancelled']);

const SUPPORT_SEEN_KEY_PREFIX = 'warmpawz_cust_sup_seen_ts_';

type ConvRow = { unread_count?: number };

export type CustomerMessageUnreadBreakdown = {
  unread_vendor_messages: number;
  unread_support_messages: number;
  total: number;
};

type SupportDetailShape = {
  ticket?: { message?: unknown; created_at?: unknown };
  responses?: { responder_type?: unknown; is_internal?: unknown; created_at?: unknown }[];
};

function supportSeenStorageKey(ticketId: string): string {
  return `${SUPPORT_SEEN_KEY_PREFIX}${ticketId}`;
}

/** Latest activity timestamp in the public thread (ms). */
export function getSupportThreadMaxTimestampMs(detail: SupportDetailShape): number {
  let max = 0;
  const tick = detail.ticket;
  if (tick && tick.message != null && String(tick.message).trim() !== '') {
    const t = new Date(String(tick.created_at || 0)).getTime();
    if (Number.isFinite(t)) max = Math.max(max, t);
  }
  for (const r of detail.responses || []) {
    if (r?.is_internal) continue;
    const t = new Date(String(r?.created_at || 0)).getTime();
    if (Number.isFinite(t)) max = Math.max(max, t);
  }
  return max;
}

/**
 * Call when the customer has viewed the support thread (detail loaded in UI).
 * Persists the max message time they saw; unread clears until a newer message lands.
 */
export function markSupportThreadSeenInBrowser(ticketId: string, detail: SupportDetailShape): void {
  if (typeof localStorage === 'undefined' || !ticketId.trim()) return;
  const maxTs = getSupportThreadMaxTimestampMs(detail);
  if (maxTs <= 0) return;
  try {
    localStorage.setItem(supportSeenStorageKey(ticketId), String(maxTs));
  } catch {
    /* ignore quota */
  }
}

function getSupportSeenUpToMs(ticketId: string): number {
  if (typeof localStorage === 'undefined' || !ticketId.trim()) return 0;
  try {
    const raw = localStorage.getItem(supportSeenStorageKey(ticketId));
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** True if the last non-internal message is from support AND newer than what the customer last viewed. */
export function supportTicketDetailIndicatesUnreadForCustomer(
  detail: SupportDetailShape,
  ticketId: string
): boolean {
  const tick = detail.ticket;
  if (!tick) return false;
  type Turn = { t: number; customer: boolean };
  const turns: Turn[] = [];
  const initial = tick.message != null ? String(tick.message).trim() : '';
  if (initial) {
    turns.push({
      t: new Date(String(tick.created_at || 0)).getTime(),
      customer: true,
    });
  }
  for (const r of detail.responses || []) {
    if (r?.is_internal) continue;
    const rt = String(r?.responder_type || '').toLowerCase();
    const customer = rt === 'customer';
    turns.push({
      t: new Date(String(r?.created_at || 0)).getTime(),
      customer,
    });
  }
  if (turns.length === 0) return false;
  turns.sort((a, b) => a.t - b.t);
  const last = turns[turns.length - 1]!;
  if (last.customer) return false;
  const threadTipMs = getSupportThreadMaxTimestampMs(detail);
  // Primary: server-side timestamp — reliable on all devices including iOS
  const serverViewedAt = (tick as Record<string, unknown>).customer_viewed_at;
  if (serverViewedAt) {
    const serverViewedMs = new Date(String(serverViewedAt)).getTime();
    if (Number.isFinite(serverViewedMs) && serverViewedMs > 0 && serverViewedMs >= threadTipMs) {
      return false;
    }
  }
  // Fallback: localStorage — for immediate UI response before server round-trip
  const seenUpTo = getSupportSeenUpToMs(ticketId);
  if (seenUpTo > 0 && threadTipMs > 0 && seenUpTo >= threadTipMs) {
    return false;
  }
  return true;
}

function sumVendorUnreadFromConversations(conversations: ConvRow[]): number {
  let s = 0;
  for (const c of conversations) {
    const n = Number(c?.unread_count ?? 0);
    if (Number.isFinite(n) && n > 0) s += n;
  }
  return s;
}

/**
 * List-row unread heuristic (no per-ticket detail GET).
 * Prefer explicit unread flags; else compare updated_at vs customer_viewed_at / local seen tip.
 */
export function supportTicketListRowIndicatesUnread(row: Record<string, unknown>): boolean {
  const id = row?.id != null ? String(row.id).trim() : '';
  if (!id) return false;
  const status = String(row?.status || '').toLowerCase();
  if (EXCLUDED_TICKET_STATUSES.has(status)) return false;

  if (row.has_unread === true || row.hasUnread === true || row.customer_has_unread === true) {
    return true;
  }
  const explicitUnread = Number(row.unread_count ?? row.unreadCount ?? 0);
  if (Number.isFinite(explicitUnread) && explicitUnread > 0) return true;

  const tipRaw =
    row.last_message_at ??
    row.lastMessageAt ??
    row.last_updated_at ??
    row.lastUpdatedAt ??
    row.updated_at ??
    row.updatedAt;
  const tipMs = tipRaw != null ? new Date(String(tipRaw)).getTime() : NaN;
  if (!Number.isFinite(tipMs) || tipMs <= 0) {
    // No activity timestamps — do not inflate badge
    return false;
  }

  const viewedRaw = row.customer_viewed_at ?? row.customerViewedAt;
  if (viewedRaw) {
    const viewedMs = new Date(String(viewedRaw)).getTime();
    if (Number.isFinite(viewedMs) && viewedMs > 0 && viewedMs >= tipMs) return false;
  }

  const seenLocal = getSupportSeenUpToMs(id);
  if (seenLocal > 0 && seenLocal >= tipMs) return false;

  // Never viewed, or last view older than tip → unread for badge
  return true;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fetchCustomerMessageUnreadBreakdown(opts: {
  customerId?: string;
  /** Raw phone string (digits normalized inside). */
  phoneForApi: string;
}): Promise<CustomerMessageUnreadBreakdown> {
  const idParam = opts.customerId && UUID_RE.test(opts.customerId.trim()) ? opts.customerId.trim() : undefined;
  const digits = opts.phoneForApi.replace(/\D/g, '');

  let unread_vendor_messages = 0;
  if (idParam || digits.length >= 8) {
    try {
      const q = new URLSearchParams();
      if (idParam) q.set('customerId', idParam);
      if (digits.length >= 8) q.set('phone', digits);
      const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
      const list = Array.isArray(res?.conversations) ? res.conversations : [];
      unread_vendor_messages = sumVendorUnreadFromConversations(list);
    } catch {
      unread_vendor_messages = 0;
    }
  }

  let unread_support_messages = 0;
  if (idParam || digits.length >= 10) {
    try {
      const rawPhone = opts.phoneForApi.trim();
      const res = (await supportCrmApi.getTickets({
        customerId: idParam,
        customerPhone: rawPhone || undefined,
        limit: 40,
        offset: 0,
      })) as { tickets?: Record<string, unknown>[] };
      const tickets = Array.isArray(res?.tickets) ? res.tickets : [];
      for (const t of tickets) {
        if (supportTicketListRowIndicatesUnread(t)) unread_support_messages += 1;
      }
    } catch {
      unread_support_messages = 0;
    }
  }

  return {
    unread_vendor_messages,
    unread_support_messages,
    total: unread_vendor_messages + unread_support_messages,
  };
}
