/**
 * Merges booking chat conversations (GET /chat/conversations) with support tickets
 * (GET /support/tickets) for a single customer inbox, sorted by recency.
 *
 * Tradeoff (client merge vs one API): avoids backend scope and keeps the booking endpoint
 * unchanged. Extra round trip and the client must stay aligned with two response shapes;
 * a future UNION in GET /chat/conversations would reduce calls but requires server-wide
 * schema and auth decisions.
 */

import { BookingChatApi, SupportCrmApi } from '../../services/api';

export const SUPPORT_INBOX_LABEL = 'Warmpawz Support';

/** Excluded from the merged list — keeps “open/recent”-style threads. */
const EXCLUDED_TICKET_STATUSES = new Set(['closed', 'cancelled']);

export type UnifiedInboxRow =
  | {
      kind: 'booking';
      listKey: string;
      bookingId: string;
      participant_name?: string;
      booking_service?: string;
      last_message?: string;
      last_message_time?: string;
      unread_count?: number;
    }
  | {
      kind: 'support';
      listKey: string;
      ticketId: string;
      /** Short for subtitle line, e.g. #WPZ-… or first 8 chars of id */
      idSnippet: string;
      subject: string;
      status?: string;
      last_message: string;
      last_message_time: string;
    };

function sortTimeMs(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(String(iso)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function idSnippetFromTicket(t: any): string {
  const n = t?.ticket_number ?? t?.ticketNumber;
  if (n != null && String(n).trim() !== '') return String(n);
  const id = String(t?.id || '');
  if (id.length > 8) return `#${id.slice(0, 8)}…`;
  return id || '#—';
}

function supportFromApiTicket(t: any): UnifiedInboxRow | null {
  const ticketId = (t?.id != null ? String(t.id) : '').trim();
  if (!ticketId) return null;
  const status = String(t?.status || '').toLowerCase();
  if (EXCLUDED_TICKET_STATUSES.has(status)) return null;
  const subject = String(t?.subject || 'Support request').trim() || 'Support request';
  const msg = String(t?.message || '').trim();
  const time = String(
    t?.last_updated_at ||
      t?.lastUpdatedAt ||
      t?.updated_at ||
      t?.updatedAt ||
      t?.created_at ||
      t?.createdAt ||
      '',
  ).trim();

  return {
    kind: 'support',
    listKey: `support-${ticketId}`,
    ticketId,
    idSnippet: idSnippetFromTicket(t),
    subject,
    status: t?.status,
    last_message: msg || subject,
    last_message_time: time,
  };
}

function bookingFromApi(r: any): UnifiedInboxRow | null {
  const bookingId = (r?.booking_id ?? r?.id ?? '')
    .toString()
    .trim();
  if (!bookingId) return null;
  return {
    kind: 'booking',
    listKey: `booking-${bookingId}`,
    bookingId,
    participant_name: r?.participant_name,
    booking_service: r?.booking_service,
    last_message: r?.last_message,
    last_message_time: r?.last_message_time,
    unread_count: typeof r?.unread_count === 'number' ? r.unread_count : r?.unread_count,
  };
}

/**
 * One GET /support/tickets with `customerId` + session `phone`. Backend (support-crm) matches
 * rows by id OR by normalized / last-10-digits phone so the same list works as web "My tickets".
 * Fallback: extra phone-only fetches if the first call fails or returns nothing (old deployed API).
 */
async function loadSupportTicketRowsForInbox(params: { customerId?: string; phone: string }): Promise<UnifiedInboxRow[]> {
  const rawPhone = (params.phone || '').trim();
  const cid = (params.customerId || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  if (!cid && !rawPhone) {
    return [];
  }
  const byTicketId = new Map<string, any>();
  const merge = (res: any) => {
    const list = res?.tickets;
    if (!Array.isArray(list)) return;
    for (const t of list) {
      if (t?.id != null) byTicketId.set(String(t.id), t);
    }
  };
  const tryFetches: Array<ReturnType<typeof SupportCrmApi.getTickets>> = [
    SupportCrmApi.getTickets({
      customerId: cid || undefined,
      customerPhone: rawPhone || undefined,
      limit: 40,
      offset: 0,
    }),
  ];
  if (digits) {
    tryFetches.push(SupportCrmApi.getTickets({ customerPhone: digits, limit: 40, offset: 0 }));
  }
  if (digits.length === 10) {
    tryFetches.push(SupportCrmApi.getTickets({ customerPhone: `+91${digits}`, limit: 40, offset: 0 }));
  }
  const settled = await Promise.allSettled(tryFetches);
  for (const s of settled) {
    if (s.status === 'rejected') {
      console.warn('unifiedInbox: getTickets failed', s.reason);
      continue;
    }
    merge(s.value);
  }
  const rows: UnifiedInboxRow[] = [];
  for (const t of byTicketId.values()) {
    const row = supportFromApiTicket(t);
    if (row) rows.push(row);
  }
  return rows;
}

function dedupeByKey(
  items: UnifiedInboxRow[],
  getKey: (r: UnifiedInboxRow) => string | null,
): UnifiedInboxRow[] {
  const best = new Map<string, UnifiedInboxRow>();
  for (const r of items) {
    const k = getKey(r);
    if (!k) continue;
    const cur = best.get(k);
    if (!cur) {
      best.set(k, r);
      continue;
    }
    const tNew = sortTimeMs(r.last_message_time);
    const tOld = sortTimeMs(cur.last_message_time);
    if (tNew >= tOld) best.set(k, r);
  }
  return Array.from(best.values());
}

/**
 * Load conversations and tickets in parallel, merge, sort by last activity (desc), dedupe.
 */
export async function loadUnifiedInbox(params: {
  customerId?: string;
  phone: string;
}): Promise<UnifiedInboxRow[]> {
  const convPromise = BookingChatApi.getConversations({
    customerId: params.customerId,
    phone: params.phone,
  });

  const ticketsPromise = loadSupportTicketRowsForInbox({
    customerId: params.customerId,
    phone: params.phone,
  });

  const [convRes, tickRes] = await Promise.allSettled([convPromise, ticketsPromise]);

  const out: UnifiedInboxRow[] = [];

  if (convRes.status === 'fulfilled') {
    const list = (convRes.value as any)?.conversations;
    if (Array.isArray(list)) {
      for (const r of list) {
        const row = bookingFromApi(r);
        if (row) out.push(row);
      }
    }
  }

  if (tickRes.status === 'fulfilled' && Array.isArray(tickRes.value)) {
    for (const row of tickRes.value) {
      out.push(row);
    }
  } else if (tickRes.status === 'rejected') {
    console.warn('unifiedInbox: support tickets failed', tickRes.reason);
  }

  const deduped = dedupeByKey(out, (r) => {
    if (r.kind === 'booking') return `b:${r.bookingId}`;
    if (r.kind === 'support') return `s:${r.ticketId}`;
    return null;
  });

  deduped.sort(
    (a, b) => sortTimeMs(b.last_message_time) - sortTimeMs(a.last_message_time),
  );

  return deduped;
}

export function formatInboxRelative(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
